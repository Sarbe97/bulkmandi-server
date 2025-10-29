import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyUtrDto } from './dto/verify-utr.dto';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>
  ) {}

  async create(orgId: string, dto: CreatePaymentDto) {
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== orgId) throw new BadRequestException('This order does not belong to you');
    const existing = await this.paymentModel.findOne({ orderId: dto.orderId });
    if (existing) throw new BadRequestException('Payment already initiated');
    const payment = new this.paymentModel({
      paymentId: `PAY-${Date.now()}`,
      orderId: dto.orderId,
      amount: order.pricing.grandTotal, // or main payable field
      currency: 'INR',
      paymentMethod: dto.paymentMethod,
      escrowHoldAmount: order.pricing.grandTotal,
      escrowHoldStatus: 'ACTIVE',
      payerId: orgId,
      status: 'INITIATED',
      statusTimeline: [{ status: 'INITIATED', timestamp: new Date() }],
      initiatedAt: new Date(),
    });
    return payment.save();
  }

  async verifyUTR(paymentId: string, dto: VerifyUtrDto) {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    payment.utr = dto.utr;
    payment.status = 'VERIFIED';
    payment.bankVerifiedAt = new Date();
    payment.statusTimeline.push({ status: 'VERIFIED', timestamp: new Date() });
    await payment.save();
    // Update the order status as PAID
    await this.orderModel.findByIdAndUpdate(payment.orderId, { status: 'PAID' });
    return payment;
  }

  async findByIdOrFail(id: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async findByPayerId(payerId: string, filters: Record<string, any> = {}, page = 1, limit = 20) {
    return this.paymentModel.find({ payerId, ...filters }).skip((page - 1) * limit).limit(limit);
  }

  async findByOrderId(orderId: string) {
    return this.paymentModel.findOne({ orderId });
  }

  async releaseEscrow(paymentId: string, adminId: string, reason: string) {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    payment.escrowHoldStatus = 'RELEASED';
    payment.escrowReleaseAt = new Date();
    payment.escrowReleaseReason = reason;
    return payment.save();
  }

  async refund(paymentId: string, amount: number, reason: string) {
    // Implement actual refund logic
    return { paymentId, amount, refunded: true, reason };
  }
}
