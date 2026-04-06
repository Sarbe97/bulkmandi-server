import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly rfqService: RfqService,
    private readonly orgService: OrganizationsService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => DisputesService)) private readonly disputesService: DisputesService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(dto: CreateOrderDto) {
    this.logger.log('Creating new order manually');
    const orderId = `ORD-${Date.now()}`;
    const order = new this.orderModel({ ...dto, orderId, createdAt: new Date(), status: 'PI_ISSUED' });
    const saved = await order.save();

    this.auditService.log({
      action: 'ORDER_CREATED',
      module: 'ORDER',
      entityType: 'ORDER',
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

    const orderId = `ORD-${Date.now()}`;

    const specs = [
      rfq.product?.subCategory ? `Sub: ${rfq.product.subCategory}` : '',
      rfq.product?.size ? `Size: ${rfq.product.size}` : '',
      rfq.product?.tolerance ? `Tol: ${rfq.product.tolerance}` : '',
      rfq.product?.millTcRequired ? 'Mill TC Required' : '',
    ].filter(Boolean).join(', ');

    const TAX_RATE = 18;
    const baseAmount = quote.totalPriceBase || (quote.pricePerMT * quote.quantityMT);
    const freightTotal = quote.totalFreight || (quote.freightPerMT * quote.quantityMT);
    const subTotal = baseAmount + freightTotal;
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
      pricing: { pricePerMT: quote.pricePerMT, quantityMT: quote.quantityMT, baseAmount, freightPerMT: quote.freightPerMT, freightTotal, taxRate: TAX_RATE, taxAmount, grandTotal, currency: quote.currency || 'INR' },
      incoterm: rfq.incoterm,
      deliveryPin: rfq.targetPin,
      deliveryCity: 'N/A',
      deliveryState: 'N/A',
      deliveryBy: deliveryDate,
      logisticsPreference: rfq.logisticsPreference || 'PLATFORM_3PL',
      status: 'PI_ISSUED',
      lifecycle: { confirmedAt: new Date(), paymentPendingAt: new Date() },
    });

    const saved = await order.save();

    this.auditService.log({
      action: 'ORDER_CREATED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: buyerId,
      afterState: { orderId: saved.orderId, status: 'PI_ISSUED', grandTotal },
      description: `Order ${saved.orderId} created from Quote ${quote.quoteId} by buyer ${buyerOrg.legalName}. Status: PI_ISSUED.`,
    });

    // ✅ Notify Buyer: Proforma Invoice Issued
    try {
      await this.notificationsService.notify(
        buyerId,
        "📄 Proforma Invoice Issued",
        `A Proforma Invoice has been issued for your order ${saved.orderId}. Please review and confirm to proceed.`,
        {
          template: "order-status",
          data: {
            orderId: saved.orderId,
            status: "PI_ISSUED",
            type: "ORDER ALERT",
            orderUrl: `${process.env.FRONTEND_URL}/buyer/orders/${saved._id}`,
          },
          category: "ORDER",
        }
      );
    } catch (notifyErr) {
      this.logger.error(`Failed to dispatch order creation notification: ${notifyErr.message}`);
    }

    return saved;
  }

  async findByBuyerId(buyerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ buyerId: new Types.ObjectId(buyerId), ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findBySellerId(sellerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ sellerId: new Types.ObjectId(sellerId), ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findAll(filter = {}, page = 1, limit = 50) {
    return this.orderModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findByIdOrFail(id: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByOrderIdOrFail(orderId: string) {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  async updateStatus(id: string, status: string) {
    this.logger.log(`Updating order status for ID: ${id} to ${status}`);
    const order = await this.orderModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) throw new NotFoundException('Order not found');

    this.auditService.log({
      action: 'ORDER_STATUS_CHANGED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: order._id as any,
      entityIdStr: order.orderId,
      afterState: { status },
      actorType: 'SYSTEM',
      description: `Order ${order.orderId} status updated to ${status}`,
    });

    return order;
  }

  async markDispatchReady(id: string, sellerId: string) {
    const order = await this.orderModel.findById(id);
    if (!order || order.sellerId.toString() !== sellerId) throw new NotFoundException('Order not found');

    const prevStatus = order.status;
    order.status = 'DISPATCH_PREP';
    order.lifecycle.dispatchPrepAt = new Date();
    const saved = await order.save();

    this.auditService.log({
      action: 'ORDER_STATUS_CHANGED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: sellerId,
      beforeState: { status: prevStatus },
      afterState: { status: 'DISPATCH_PREP' },
      changedFields: ['status'],
      description: `Order ${saved.orderId} marked DISPATCH_PREP by seller`,
    });

    return saved;
  }

  async registerShipment(orderId: string, shipmentId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.shipmentIds.push(new Types.ObjectId(shipmentId));
    order.shipmentCount = (order.shipmentCount || 0) + 1;

    if (order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED') {
      order.status = 'IN_TRANSIT';
    }

    return order.save();
  }

  async cancel(id: string, userId: string, reason: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const prevStatus = order.status;
    order.status = 'CANCELLED';
    order.lifecycle.cancelledAt = new Date();
    const saved = await order.save();

    this.auditService.log({
      action: 'ORDER_CANCELLED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: 'CANCELLED', reason },
      changedFields: ['status'],
      description: `Order ${saved.orderId} cancelled. Reason: ${reason}`,
      severity: 'WARNING',
    });

    return saved;
  }

  async acceptDelivery(orderId: string, buyerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Order is not in DELIVERED status');

    order.status = 'COMPLETED';
    order.lifecycle.completedAt = new Date();

    // Mark settlement timer as completed
    if (order.payoutTimer) {
      order.payoutTimer.status = 'COMPLETED';
      order.payoutTimer.remainingMs = 0;
    }

    try {
      await this.paymentsService.releaseStage2(orderId);
    } catch (err) {
      this.logger.warn(`Stage 2 escrow release failed for order ${orderId}: ${err.message}`);
    }

    await order.save();

    this.auditService.log({
      action: 'DELIVERY_ACCEPTED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: order._id as any,
      entityIdStr: order.orderId,
      actorId: buyerId,
      beforeState: { status: 'DELIVERED' },
      afterState: { status: 'COMPLETED' },
      changedFields: ['status'],
      description: `Delivery accepted for Order ${order.orderId} by buyer`,
    });

    // ✅ Notify Seller: Delivery Accepted (Payout coming)
    try {
      await this.notificationsService.notify(
        order.sellerId.toString(),
        "🏁 Delivery Accepted",
        `Buyer has accepted the delivery for Order ${order.orderId}. The final escrow amount will be released to your account according to the settlement cycle.`,
        {
          template: "order-status",
          data: {
            orderId: order.orderId,
            status: "COMPLETED",
            type: "ORDER UPDATE",
            orderUrl: `${process.env.FRONTEND_URL}/seller/orders/${order._id}`,
          },
          category: "ORDER",
        }
      );
    } catch (notifyErr) {
      this.logger.error(`Failed to dispatch delivery acceptance notification: ${notifyErr.message}`);
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
      claimantRole: 'BUYER',
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
      action: 'DELIVERY_DISPUTED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: order._id as any,
      entityIdStr: order.orderId,
      actorId: buyerId,
      afterState: { disputeType: disputeData.disputeType, claimValue: disputeData.claimValue, disputeId: dispute._id?.toString() },
      description: `Delivery disputed for Order ${order.orderId}: ${disputeData.disputeType}`,
      severity: 'WARNING',
    });

    // ✅ Notify Seller: Order Disputed (Settlement Paused)
    try {
      await this.notificationsService.notify(
        order.sellerId.toString(),
        "⚠️ Order Disputed",
        `A dispute has been raised for Order ${order.orderId}. Settlement for this order has been paused pending resolution.`,
        {
          template: "order-status",
          data: {
            orderId: order.orderId,
            status: "DISPUTED",
            type: "ORDER ALERT",
            remarks: disputeData.description,
            orderUrl: `${process.env.FRONTEND_URL}/seller/orders/${order._id}`,
          },
          category: "ORDER",
        }
      );
    } catch (notifyErr) {
      this.logger.error(`Failed to dispatch dispute notification: ${notifyErr.message}`);
    }

    return { order, dispute };
  }

  async confirmProforma(orderId: string, buyerId: string) {
    this.logger.log(`Confirming proforma for order: ${orderId} by buyer: ${buyerId}`);
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    
    if (order.status !== 'PI_ISSUED') {
      throw new BadRequestException(`Order is in ${order.status} status, cannot confirm Proforma`);
    }

    const prevStatus = order.status;
    order.status = 'PAYMENT_PENDING';
    order.lifecycle.confirmedAt = new Date();
    order.lifecycle.paymentPendingAt = new Date();
    const saved = await order.save();

    this.auditService.log({
      action: 'ORDER_PI_CONFIRMED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: saved._id as any,
      entityIdStr: saved.orderId,
      actorId: buyerId,
      beforeState: { status: prevStatus },
      afterState: { status: 'PAYMENT_PENDING' },
      description: `Proforma Invoice confirmed for Order ${saved.orderId} by buyer. Moving to payment.`,
    });

    // ✅ Notify Seller: Order Confirmed
    try {
      await this.notificationsService.notify(
        saved.sellerId.toString(),
        "✅ Order Confirmed",
        `Buyer has confirmed the Proforma Invoice for Order ${saved.orderId}. The order status is now PAYMENT_PENDING.`,
        {
          template: "order-status",
          data: {
            orderId: saved.orderId,
            status: "PAYMENT_PENDING",
            type: "ORDER UPDATE",
            orderUrl: `${process.env.FRONTEND_URL}/seller/orders/${saved._id}`,
          },
          category: "ORDER",
        }
      );
    } catch (notifyErr) {
      this.logger.error(`Failed to dispatch order confirmation notification: ${notifyErr.message}`);
    }

    return saved;
  }

  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }

  async findAllPendingSettlement() {
    return this.orderModel.find({
      status: 'DELIVERED',
      'payoutTimer.status': 'RUNNING'
    }).exec();
  }

  async initiateSettlementTimer(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) return;

    this.logger.log(`Initiating 48h settlement timer for order: ${orderId}`);
    
    order.status = 'DELIVERED';
    order.lifecycle.deliveredAt = new Date();
    
    order.payoutTimer = {
      status: 'RUNNING',
      remainingMs: 172800000, // 48 hours
      lastTickedAt: new Date(),
    };

    await order.save();

    this.auditService.log({
      action: 'SETTLEMENT_TIMER_STARTED',
      module: 'ORDER',
      entityType: 'ORDER',
      entityId: order._id as any,
      entityIdStr: order.orderId,
      afterState: { status: 'RUNNING', remainingMs: 172800000 },
      description: `48h Settlement Timer started for Order ${order.orderId}`,
    });
  }
}
