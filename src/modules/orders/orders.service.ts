import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>
  ) {}

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

  async findByBuyerId(buyerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ buyerId, ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findBySellerId(sellerId: string, filter = {}, page = 1, limit = 20) {
    return this.orderModel.find({ sellerId, ...filter }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
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
    return order.save();
  }

  async cancel(id: string, userId: string, reason: string) {
    // You can check if user is buyer or seller of that order
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    order.status = 'CANCELLED';
    // Optionally record cancellation reason/user
    return order.save();
  }

  // Placeholder for getDocuments and uploadDocument; requires file storage logic
  async getDocuments(id: string) { return {}; }
  async uploadDocument(id: string, type: string, body: any) { return {}; }
}
