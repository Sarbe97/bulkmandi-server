import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PaymentsService } from '../payments/payments.service';
import { DisputesService } from '../disputes/disputes.service';
import { RfqService } from '../rfq/rfq.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly rfqService: RfqService,
    private readonly orgService: OrganizationsService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => DisputesService)) private readonly disputesService: DisputesService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOrderDto) {
    const orderId = `ORD-${Date.now()}`;
    const order = new this.orderModel({ ...dto, orderId, createdAt: new Date(), status: 'CONFIRMED' });
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
      status: 'PAYMENT_PENDING',
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
      afterState: { orderId: saved.orderId, status: 'PAYMENT_PENDING', grandTotal },
      description: `Order ${saved.orderId} created from Quote ${quote.quoteId} by buyer ${buyerOrg.legalName}`,
    });

    return saved;
  }

  async findByBuyerId(buyerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ buyerId: new Types.ObjectId(buyerId), ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findBySellerId(sellerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ sellerId: new Types.ObjectId(sellerId), ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findByIdOrFail(id: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, status: string) {
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
    await order.save();

    try {
      await this.paymentsService.releaseStage2(orderId);
    } catch (err) {
      console.warn('Stage 2 escrow release failed:', err.message);
    }

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
      console.warn('Stage 2 escrow hold failed:', err.message);
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

    return { order, dispute };
  }

  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }
}
