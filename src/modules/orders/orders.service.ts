import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  ) { }

  async create(dto: CreateOrderDto) {
    const orderId = `ORD-${Date.now()}`;
    const order = new this.orderModel({
      ...dto,
      orderId,
      createdAt: new Date(),
      status: 'CONFIRMED',
    });
    return order.save();
  }

  async createFromQuote(quote: any, buyerId: string) {
    // 1. Fetch RFQ details
    const rfq = await this.rfqService.findByIdOrFail(quote.rfqId);

    // 2. Fetch Buyer Organization
    const buyerOrg = await this.orgService.getOrganization(buyerId);

    // 3. Calculate Delivery Date based on Quote Lead Days
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + (quote.leadDays || 7));

    // 4. Construct Order ID
    const orderId = `ORD-${Date.now()}`;

    // 5. Construct Specifications String
    const specs = [
      rfq.product?.subCategory ? `Sub: ${rfq.product.subCategory}` : '',
      rfq.product?.size ? `Size: ${rfq.product.size}` : '',
      rfq.product?.tolerance ? `Tol: ${rfq.product.tolerance}` : '',
      rfq.product?.millTcRequired ? 'Mill TC Required' : ''
    ].filter(Boolean).join(', ');

    // 6. Calculate Taxes (GST @ 18% on base + freight)
    const TAX_RATE = 18; // GST percentage
    const baseAmount = quote.totalPriceBase || (quote.pricePerMT * quote.quantityMT);
    const freightTotal = quote.totalFreight || (quote.freightPerMT * quote.quantityMT);
    const subTotal = baseAmount + freightTotal;
    const taxAmount = Math.round(subTotal * (TAX_RATE / 100));
    const grandTotal = subTotal + taxAmount;

    // 7. Create Order with PAYMENT_PENDING status (buyer must pay to escrow)
    const order = new this.orderModel({
      orderId,
      rfqId: rfq._id, // ObjectId
      quoteId: quote._id, // ObjectId
      buyerId: new Types.ObjectId(buyerOrg._id.toString()),
      buyerOrgName: buyerOrg.legalName,
      sellerId: new Types.ObjectId(quote.sellerId),
      sellerOrgName: quote.sellerOrgName,
      product: {
        category: rfq.product?.category,
        grade: rfq.product?.grade,
        quantityMT: quote.quantityMT,
        specifications: specs || 'Standard'
      },
      pricing: {
        pricePerMT: quote.pricePerMT,
        quantityMT: quote.quantityMT,
        baseAmount,
        freightPerMT: quote.freightPerMT,
        freightTotal,
        taxRate: TAX_RATE,
        taxAmount,
        grandTotal,
        currency: quote.currency || 'INR'
      },
      incoterm: rfq.incoterm,
      deliveryPin: rfq.targetPin,
      deliveryCity: 'N/A', // TODO: Fetch from PIN
      deliveryState: 'N/A',
      deliveryBy: deliveryDate,
      status: 'PAYMENT_PENDING',
      lifecycle: {
        confirmedAt: new Date(),
        paymentPendingAt: new Date()
      }
    });

    return order.save();
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
    return order;
  }

  async markDispatchReady(id: string, sellerId: string) {
    const order = await this.orderModel.findById(id);
    if (!order || order.sellerId.toString() !== sellerId) throw new NotFoundException('Order not found');
    order.status = 'DISPATCH_PREP';
    order.lifecycle.dispatchPrepAt = new Date();
    return order.save();
  }

  async registerShipment(orderId: string, shipmentId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.shipmentIds.push(new Types.ObjectId(shipmentId));
    order.shipmentCount = (order.shipmentCount || 0) + 1;

    // If not already in transit, mark it
    if (order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED') {
      order.status = 'IN_TRANSIT';
    }

    return order.save();
  }

  async cancel(id: string, userId: string, reason: string) {
    // You can check if user is buyer or seller of that order
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    order.status = 'CANCELLED';
    order.lifecycle.cancelledAt = new Date();
    // Optionally record cancellation reason/user
    return order.save();
  }

  // ─── Delivery Decision ──────────────────────────────────────

  /**
   * Buyer accepts delivery → order COMPLETED → Stage 2 escrow released
   */
  async acceptDelivery(orderId: string, buyerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Order is not in DELIVERED status');

    order.status = 'COMPLETED';
    order.lifecycle.completedAt = new Date();
    await order.save();

    // Release Stage 2 escrow (remaining 20%)
    try {
      await this.paymentsService.releaseStage2(orderId);
    } catch (err) {
      console.warn('Stage 2 escrow release failed:', err.message);
    }

    return order;
  }

  /**
   * Buyer disputes delivery → escrow Stage 2 held → dispute created
   */
  async disputeDelivery(
    orderId: string,
    buyerId: string,
    disputeData: { disputeType: string; description: string; claimValue?: number },
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== buyerId) throw new BadRequestException('Not your order');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Order is not in DELIVERED status');

    // Hold Stage 2 escrow (20% stays locked)
    try {
      await this.paymentsService.holdStage2(orderId);
    } catch (err) {
      console.warn('Stage 2 escrow hold failed:', err.message);
    }

    // Create dispute record
    const dispute = await this.disputesService.raise(buyerId, {
      orderId,
      disputeType: disputeData.disputeType,
      description: disputeData.description,
      claimantRole: 'BUYER',
      respondentId: order.sellerId.toString(),
      respondentRole: 'SELLER',
      claimValue: disputeData.claimValue || order.pricing.grandTotal * 0.20,
    });

    // Mark order as disputed
    order.disputeIds.push(dispute._id as any);
    order.lifecycle.disputedAt = new Date();
    await order.save();

    return { order, dispute };
  }

  // Placeholder for getDocuments and uploadDocument; requires file storage logic
  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }
}
