import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/services/users.service';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PaymentsService } from '../payments/payments.service';
import { DisputesService } from '../disputes/disputes.service';
import { RfqService } from '../rfq/rfq.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, ShipmentRfqStatus } from 'src/common/enums';
import { AuditAction, AuditModule, AuditEntityType, LogisticsPreference } from 'src/common/constants/app.constants';
import { ShipmentsService } from '../shipments/shipments.service';
import { IdGeneratorService } from 'src/common/services/id-generator.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly rfqService: RfqService,
    private readonly orgService: OrganizationsService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => DisputesService)) private readonly disputesService: DisputesService,
    @Inject(forwardRef(() => ShipmentsService)) private readonly shipmentService: ShipmentsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(dto: CreateOrderDto) {
    this.logger.log('Creating new order manually');
    
    // FETCH BUYER ORG CODE
    let orgCode: string | undefined;
    try {
      const org = await this.orgService.getOrganization(dto.buyerId);
      orgCode = org.orgCode;
    } catch {
      this.logger.warn(`Could not fetch org code for buyer ${dto.buyerId}`);
    }

    const orderId = this.idGenerator.generateBusinessId('ORD', orgCode);
    const order = new this.orderModel({ ...dto, orderId, createdAt: new Date(), status: OrderStatus.PI_ISSUED });
    const saved = await order.save();

    this.auditService.log({
      action: AuditAction.ORDER_CREATED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      afterState: { orderId: saved.orderId, status: saved.status },
      description: `Order ${saved.orderId} created`,
    });

    return saved;
  }

  async createFromQuote(quote: any, buyerId: string) {
    this.logger.log(`Creating order from quote: ${quote.quoteId} for buyer: ${buyerId}`);
    const rfq = await this.rfqService.findByIdOrFail(quote.rfqId);
    const buyerOrg = await this.orgService.getOrganization(buyerId);

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + (quote.leadDays || 7));

    const orderId = this.idGenerator.generateBusinessId('ORD', buyerOrg?.orgCode);

    const specs = [
      rfq.product?.subCategory ? `Sub: ${rfq.product.subCategory}` : '',
      rfq.product?.size ? `Size: ${rfq.product.size}` : '',
      rfq.product?.tolerance ? `Tol: ${rfq.product.tolerance}` : '',
      rfq.product?.millTcRequired ? 'Mill TC Required' : '',
    ].filter(Boolean).join(', ');

    const TAX_RATE = 18;
    const PLATFORM_FEE_RATE = 2; // 2% Platform Fee
    const FREIGHT_RATE_PER_MT_KM = 3.4; // Conservative high-side rate per MT per KM

    const baseAmount = quote.totalPriceBase || (quote.pricePerMT * quote.quantityMT);
    
    // Determine Logistics Preference
    const logisticsPreference = rfq.logisticsPreference || LogisticsPreference.PLATFORM_3PL;
    
    // Calculate Freight
    let freightPerMT = quote.freightPerMT;
    let freightTotal = quote.totalFreight || (quote.freightPerMT * quote.quantityMT);

    if (logisticsPreference === LogisticsPreference.PLATFORM_3PL) {
      // System-Calculated Estimate for 3PL
      const sellerPin = parseInt(quote.sellerPlantPin?.replace(/\D/g, '') || '0') || 400001; // Fallback to Mumbai if missing
      const buyerPin = parseInt(rfq.targetPin?.replace(/\D/g, '') || '0') || 110001; // Fallback to Delhi if missing
      
      const distance = Math.max(100, Math.abs(sellerPin - buyerPin) % 2000); // Deterministic dummy distance
      freightPerMT = Math.round(distance * FREIGHT_RATE_PER_MT_KM);
      freightTotal = freightPerMT * quote.quantityMT;
      
      this.logger.log(`3PL Freight Estimated: distance ${distance}km, rate ${freightPerMT}/MT, total ${freightTotal}`);
    }
    
    // Calculate Platform Fee
    const platformFee = Math.round(baseAmount * (PLATFORM_FEE_RATE / 100));
    
    // Final Landed Cost
    const subTotal = baseAmount + freightTotal + platformFee;
    const taxAmount = Math.round(subTotal * (TAX_RATE / 100));
    const grandTotal = subTotal + taxAmount;

    const order = new this.orderModel({
      orderId,
      rfqId: rfq._id,
      quoteId: quote._id,
      buyerId: new Types.ObjectId(buyerOrg._id.toString()),
      buyerOrgName: buyerOrg.legalName,
      sellerId: new Types.ObjectId(quote.sellerId),
      sellerOrgName: quote.sellerOrgName,
      product: {
        category: rfq.product?.category,
        grade: rfq.product?.grade,
        quantityMT: quote.quantityMT,
        specifications: specs || 'Standard',
      },
      pricing: { 
        pricePerMT: quote.pricePerMT, 
        quantityMT: quote.quantityMT, 
        baseAmount, 
        freightPerMT, 
        freightTotal, 
        platformFee,
        taxRate: TAX_RATE, 
        taxAmount, 
        grandTotal, 
        currency: quote.currency || 'INR' 
      },
      incoterm: rfq.incoterm,
      paymentTerms: quote.paymentTerms || '80/20 Escrow (Loading/POD)',
      deliveryPin: rfq.targetPin,
      pickupPin: quote.sellerPlantPin,
      deliveryCity: 'N/A',
      deliveryState: 'N/A',
      deliveryBy: deliveryDate,
      logisticsPreference,
      status: OrderStatus.PI_ISSUED,
      lifecycle: { confirmedAt: new Date(), paymentPendingAt: new Date() },
    });



    const saved = await order.save();

    this.auditService.log({
      action: AuditAction.ORDER_CREATED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: buyerId,
      afterState: { orderId: saved.orderId, status: OrderStatus.PI_ISSUED, grandTotal },
      targetOrgIds: [buyerOrg._id as any, quote.sellerId as any],
      description: `Order ${saved.orderId} created from Quote ${quote.quoteId} by buyer ${buyerOrg.legalName}. Status: PI_ISSUED.`,
    });

    // Manual notification removed: handled by AuditService derivation

    return saved;
  }

  async findByBuyerId(buyerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ buyerId: new Types.ObjectId(buyerId), ...filter })
      .populate('buyerOrganization')
      .populate('sellerOrganization')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  async findBySellerId(sellerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ sellerId: new Types.ObjectId(sellerId), ...filter })
      .populate('buyerOrganization')
      .populate('sellerOrganization')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  async findAll(filter = {}, page = 1, limit = 50) {
    return this.orderModel.find(filter)
      .populate('buyerOrganization')
      .populate('sellerOrganization')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  async findByIdOrFail(id: string) {
    const order = await this.orderModel.findById(id)
      .populate('buyerOrganization')
      .populate('sellerOrganization');
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByOrderIdOrFail(orderId: string) {
    const order = await this.orderModel.findOne({ orderId })
      .populate('buyerOrganization')
      .populate('sellerOrganization');
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  async updateStatus(id: string, status: string) {
    this.logger.log(`Updating order status for ID: ${id} to ${status}`);
    const order = await this.orderModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) throw new NotFoundException('Order not found');

    this.auditService.log({
      action: AuditAction.ORDER_STATUS_CHANGED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: order._id as any,
      entityIdStr: order.orderId,
      afterState: { status },
      actorType: AuditEntityType.USER,
      targetOrgIds: [order.buyerId as any, order.sellerId as any],
      description: `Order ${order.orderId} status updated to ${status}`,
    });

    return order;
  }

  async markDispatchReady(id: string, sellerId: string) {
    const order = await this.orderModel.findById(id);
    if (!order || order.sellerId.toString() !== sellerId) throw new NotFoundException('Order not found');

    // ✅ PAYMENT GATE: Dispatch cannot begin until payment is verified (PAID)
    // ✅ DISPATCH_PREP: allowed for re-trigger after a carrier rejection (order resets back here)
    // ❌ LOGISTICS_AWARDED / LOGISTICS_ACCEPTED: blocked — logistics is already in progress
    const allowedFromStatuses = [OrderStatus.PAID, OrderStatus.DISPATCH_PREP];
    if (!allowedFromStatuses.includes(order.status as any)) {
      throw new BadRequestException(
        `Cannot mark dispatch ready: Order is in '${order.status}' status. Payment must be verified (PAID) first.`
      );
    }

    const prevStatus = order.status;
    
    // Status Guard: Only move to DISPATCH_PREP if we are currently PAID.
    // If it's already LOGISTICS_AWARDED or LOGISTICS_ACCEPTED, don't downgrade it.
    const statusesHigherThanPrep = [OrderStatus.DISPATCH_PREP, OrderStatus.LOGISTICS_AWARDED, OrderStatus.LOGISTICS_ACCEPTED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.COMPLETED];
    if (!statusesHigherThanPrep.includes(order.status as any)) {
      order.status = OrderStatus.DISPATCH_PREP;
    }

    order.lifecycle.dispatchPrepAt = new Date();
    order.markModified('lifecycle');
    const saved = await order.save();

    // TRIGGER Logistics Flow for Platform 3PL
    if (saved.logisticsPreference === LogisticsPreference.PLATFORM_3PL) {
      try {
        await this.shipmentService.createShipmentRfq(saved._id.toString());
        this.logger.log(`Automated Shipment RFQ triggered for Order ${saved.orderId}`);
      } catch (err) {
        this.logger.error(`Failed to trigger automated Shipment RFQ for Order ${saved.orderId}: ${err.message}`);
      }
    }

    // Notify Buyer (Material Ready)
    const buyerUsers = await this.usersService.findByOrgId(saved.buyerId.toString());
    for (const user of buyerUsers) {
      await this.notificationsService.notify(
        (user as any)._id.toString(),
        'Shipment is Ready!',
        `Good news! Your order #${saved.orderId} is ready for dispatch.`,
        {
          template: 'shipment-ready',
          data: {
            orderId: saved.orderId,
            pickupCity: saved.pickupPin || 'Seller Yard',
            logisticsPreference: saved.logisticsPreference,
            is3PL: saved.logisticsPreference === LogisticsPreference.PLATFORM_3PL,
            ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/orders/${saved._id}`,
          }
        }
      ).catch(e => this.logger.error(`Failed to notify buyer for Ready: ${e.message}`));
    }

    this.auditService.log({
      action: AuditAction.ORDER_STATUS_CHANGED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: sellerId,
      beforeState: { status: prevStatus },
      afterState: { status: OrderStatus.DISPATCH_PREP },
      changedFields: ['status'],
      targetOrgIds: [order.buyerId as any, order.sellerId as any],
      description: `Order ${saved.orderId} marked DISPATCH_PREP by seller`,
    });

    return saved;
  }

  async registerShipment(orderId: string, shipmentId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.shipmentIds.push(new Types.ObjectId(shipmentId));
    order.shipmentCount = (order.shipmentCount || 0) + 1;

    // ✅ DO NOT change order status here.
    // For PLATFORM_3PL: status is managed by the dedicated flow:
    //   acceptJob → LOGISTICS_ACCEPTED → confirmDispatch → IN_TRANSIT
    // For SELF_PICKUP/SELLER_MANAGED: status is set by the caller explicitly.

    return order.save();
  }

  async cancel(id: string, userId: string, reason: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const prevStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    order.lifecycle.cancelledAt = new Date();
    const saved = await order.save();

    this.auditService.log({
      action: AuditAction.ORDER_CANCELLED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: OrderStatus.CANCELLED, reason },
      changedFields: ['status'],
      description: `Order ${saved.orderId} cancelled. Reason: ${reason}`,
      severity: 'WARNING',
    });

    // Notify both parties of cancellation
    const notifyOrgs = [saved.buyerId.toString(), saved.sellerId.toString()];
    for (const orgId of notifyOrgs) {
        const users = await this.usersService.findByOrgId(orgId);
        for (const user of users) {
            await this.notificationsService.notify(
              (user as any)._id.toString(),
              'Order Cancelled',
              `Order #${saved.orderId} has been cancelled.`,
              {
                template: 'order-cancelled',
                data: { orderId: saved.orderId, reason, ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard` }
              }
            ).catch(e => this.logger.error(`Failed to notify cancellation for ${orgId}: ${e.message}`));
        }
    }

    return saved;
  }

  async acceptDelivery(orderId: string, buyerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('Order is not in DELIVERED status');

    order.status = OrderStatus.COMPLETED;
    order.lifecycle.completedAt = new Date();

    // Mark settlement timer as completed
    if (order.payoutTimer) {
      order.payoutTimer.status = 'COMPLETED';
      order.payoutTimer.remainingMs = 0;
    }

    // ✅ TERM-AWARE STAGE 2 RELEASE:
    // - 80/20: Release Stage 2 (20%) on buyer acceptance — correct trigger
    // - 50/50: Stage 2 was already released at LR verification — skip
    // - 100%:  Stage 2 amount is ₹0 — skip
    const payment = await this.paymentsService.findByOrderId(orderId);
    const shouldReleaseStage2 =
      payment &&
      payment.escrowStage2Amount > 0 &&
      payment.escrowStage2Status !== 'RELEASED';

    if (shouldReleaseStage2) {
      try {
        await this.paymentsService.releaseStage2(orderId);
      } catch (err) {
        this.logger.warn(`Stage 2 escrow release failed for order ${orderId}: ${err.message}`);
      }
    } else {
      this.logger.log(`Skipping Stage 2 release for order ${orderId}: term=${order.paymentTerms}, s2Status=${payment?.escrowStage2Status}, s2Amount=${payment?.escrowStage2Amount}`);
    }

    await order.save();

    this.auditService.log({
      action: AuditAction.DELIVERY_ACCEPTED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: order._id as any,
      entityIdStr: order.orderId,
      actorId: buyerId,
      beforeState: { status: OrderStatus.DELIVERED },
      afterState: { status: OrderStatus.COMPLETED },
      changedFields: ['status'],
      description: `Delivery accepted for Order ${order.orderId} by buyer`,
      targetOrgIds: [order.buyerId as any, order.sellerId as any],
    });

    // Notify both parties of Completion
    const notifyOrgs = [order.buyerId.toString(), order.sellerId.toString()];
    for (const orgId of notifyOrgs) {
        const users = await this.usersService.findByOrgId(orgId);
        for (const user of users) {
            await this.notificationsService.notify(
              (user as any)._id.toString(),
              'Order Completed',
              `Transaction for Order #${order.orderId} is now settled.`,
              {
                template: 'order-completed',
                data: { orderId: order.orderId, grandTotal: order.pricing.grandTotal.toLocaleString('en-IN'), ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard` }
              }
            ).catch(e => this.logger.error(`Failed to notify completion for ${orgId}: ${e.message}`));
        }
    }

    return order;
  }

  async disputeDelivery(orderId: string, buyerId: string, disputeData: { disputeType: string; description: string; claimValue?: number }) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Order is not in DELIVERED status');

    try {
      await this.paymentsService.holdStage2(orderId);
    } catch (err) {
      this.logger.warn(`Stage 2 escrow hold failed for order ${orderId}: ${err.message}`);
    }

    const dispute = await this.disputesService.raise(buyerId, {
      orderId,
      disputeType: disputeData.disputeType,
      description: disputeData.description,
      claimantRole: AuditAction.NEGOTIATION_INITIATED ? 'BUYER' : 'BUYER', // Just ensuring imports work
      respondentId: order.sellerId.toString(),
      respondentRole: 'SELLER',
      claimValue: disputeData.claimValue || order.pricing.grandTotal * 0.20,
    });

    order.disputeIds.push(dispute._id as any);
    order.lifecycle.disputedAt = new Date();
    
    // PAUSE the settlement timer
    if (order.payoutTimer && order.payoutTimer.status === 'RUNNING') {
      const now = new Date();
      if (order.payoutTimer.lastTickedAt) {
        const elapsed = now.getTime() - new Date(order.payoutTimer.lastTickedAt).getTime();
        order.payoutTimer.remainingMs = Math.max(0, order.payoutTimer.remainingMs - elapsed);
      }
      order.payoutTimer.status = 'PAUSED';
      order.payoutTimer.lastTickedAt = now;
    }

    await order.save();

    this.auditService.log({
      action: AuditAction.DELIVERY_DISPUTED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: order._id as any,
      entityIdStr: order.orderId,
      actorId: buyerId,
      afterState: { disputeType: disputeData.disputeType, claimValue: disputeData.claimValue, disputeId: dispute._id?.toString() },
      description: `Delivery disputed for Order ${order.orderId}: ${disputeData.disputeType}`,
      targetOrgIds: [order.buyerId as any, order.sellerId as any],
      severity: 'WARNING',
    });

    // Manual notification removed: handled by AuditService derivation

    return { order, dispute };
  }

  async confirmProforma(orderId: string, buyerId: string) {
    this.logger.log(`Confirming proforma for order: ${orderId} by buyer: ${buyerId}`);
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    
    if (order.status !== OrderStatus.PI_ISSUED) {
      throw new BadRequestException(`Order is in ${order.status} status, cannot confirm Proforma`);
    }

    const prevStatus = order.status;
    order.status = OrderStatus.PAYMENT_PENDING;
    order.lifecycle.confirmedAt = new Date();
    order.lifecycle.paymentPendingAt = new Date();
    const saved = await order.save();

    this.auditService.log({
      action: AuditAction.ORDER_PI_CONFIRMED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: buyerId,
      beforeState: { status: prevStatus },
      afterState: { status: OrderStatus.PAYMENT_PENDING },
      targetOrgIds: [order.buyerId as any, order.sellerId as any],
      description: `Proforma Invoice confirmed for Order ${saved.orderId} by buyer. Moving to payment.`,
    });

    // Manual notification removed: handled by AuditService derivation

    return saved;
  }

  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }

  async findAllPendingSettlement() {
    return this.orderModel.find({
      status: OrderStatus.DELIVERED,
      'payoutTimer.status': 'RUNNING'
    }).exec();
  }

  async initiateSettlementTimer(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) return;

    this.logger.log(`Initiating 48h settlement timer for order: ${orderId}`);
    
    order.status = OrderStatus.DELIVERED;
    order.lifecycle.deliveredAt = new Date();
    
    order.payoutTimer = {
      status: 'RUNNING',
      remainingMs: 172800000, // 48 hours
      lastTickedAt: new Date(),
    };

    await order.save();

    this.auditService.log({
      action: AuditAction.SETTLEMENT_TIMER_STARTED,
      module: AuditModule.ORDER,
      entityType: AuditEntityType.ORDER,
      entityId: order._id as any,
      entityIdStr: order.orderId,
      afterState: { status: 'RUNNING', remainingMs: 172800000 },
      description: `48h Settlement Timer started for Order ${order.orderId}`,
    });
  }

  /**
   * Helper to determine the next action for an order based on its status and logistics preference.
   */
  getNextAction(order: any) {
    const status = order.status;
    const pref = order.logisticsPreference;

    switch (status) {
      case OrderStatus.PI_ISSUED:
        return { actor: 'BUYER', action: 'Confirm Proforma Invoice', description: 'Review the proforma invoice and confirm to proceed to payment.' };
      
      case OrderStatus.PAYMENT_PENDING:
        return { actor: 'BUYER', action: 'Submit Payment & UTR', description: 'Make the payment to the escrow account and upload the UTR details.' };
      
      case OrderStatus.PAYMENT_SUBMITTED:
        return { actor: 'ADMIN', action: 'Verify Payment', description: 'Admin needs to verify the UTR and mark the payment as received.' };
      
      case OrderStatus.PAID:
        return { actor: 'SELLER', action: 'Prepare Material', description: 'Payment verified. Please prepare the material for dispatch.' };
      
      case OrderStatus.DISPATCH_PREP:
        if (pref === LogisticsPreference.PLATFORM_3PL) {
          return { actor: 'ADMIN', action: 'Award Logistics Bid', description: 'Material is ready. Admin must award the shipment job to a carrier.' };
        }
        return { actor: 'SELLER', action: 'Confirm Dispatch', description: 'Material is ready. Please proceed with dispatch and upload documents.' };
      
      case OrderStatus.LOGISTICS_AWARDED:
        return { actor: 'CARRIER', action: 'Accept Shipment Job', description: 'Job awarded. Carrier must explicitly accept the commitment.' };
      
      case OrderStatus.LOGISTICS_ACCEPTED:
        return { actor: 'SELLER', action: 'Confirm Dispatch', description: 'Carrier has accepted. Seller can now hand over material and confirm dispatch.' };
      
      case OrderStatus.IN_TRANSIT:
        return { actor: 'CARRIER', action: 'Update Tracking', description: 'Order is in transit. Carrier should update milestones until delivery.' };
      
      case OrderStatus.DELIVERED:
        return { actor: 'BUYER', action: 'Accept Delivery', description: 'Goods delivered. Please verify and accept delivery to release final payout.' };
      
      case OrderStatus.COMPLETED:
        return { actor: 'NONE', action: 'Order Completed', description: 'All steps finished successfully.' };
      
      default:
        return { actor: 'NONE', action: 'No Action', description: 'The order is in a static or terminal state.' };
    }
  }
}

