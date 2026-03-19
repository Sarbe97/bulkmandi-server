import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrganizationsService } from '../organizations/organizations.service';
import { RfqService } from '../rfq/rfq.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly rfqService: RfqService,
    private readonly orgService: OrganizationsService,
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

    // 6. Create Order
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
        baseAmount: quote.totalPriceBase,
        freightPerMT: quote.freightPerMT,
        freightTotal: quote.totalFreight,
        taxRate: 0, // Placeholder
        taxAmount: quote.totalTaxes || 0,
        grandTotal: quote.grandTotal,
        currency: quote.currency
      },
      incoterm: rfq.incoterm,
      deliveryPin: rfq.targetPin,
      deliveryCity: 'N/A', // TODO: Fetch from PIN
      deliveryState: 'N/A',
      deliveryBy: deliveryDate,
      status: 'CONFIRMED',
      lifecycle: {
        confirmedAt: new Date()
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

  // Placeholder for getDocuments and uploadDocument; requires file storage logic
  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }
}
