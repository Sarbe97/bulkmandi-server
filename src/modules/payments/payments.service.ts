import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyUtrDto } from './dto/verify-utr.dto';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly auditService: AuditService,
  ) {}

  async create(orgId: string, dto: CreatePaymentDto) {
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== orgId) throw new BadRequestException('This order does not belong to you');
    const existing = await this.paymentModel.findOne({ orderId: dto.orderId });
    if (existing) throw new BadRequestException('Payment already initiated');

    const paymentId = `PAY-${Date.now()}`;
    const isAutoVerify = dto.paymentMethod === 'UPI' || dto.paymentMethod === 'NETBANKING';

    const payment = new this.paymentModel({
      paymentId,
      orderId: dto.orderId,
      amount: order.pricing.grandTotal,
      currency: 'INR',
      paymentMethod: dto.paymentMethod,
      escrowHoldAmount: order.pricing.grandTotal,
      escrowHoldStatus: 'ACTIVE',
      // Staged escrow: 80% on LR, 20% on delivery acceptance
      escrowStage1Percent: 80,
      escrowStage2Percent: 20,
      escrowStage1Amount: Math.round(order.pricing.grandTotal * 0.80),
      escrowStage2Amount: Math.round(order.pricing.grandTotal * 0.20),
      escrowStage1Status: 'PENDING',
      escrowStage2Status: 'PENDING',
      payerId: orgId,
      status: isAutoVerify ? 'VERIFIED' : 'INITIATED',
      statusTimeline: isAutoVerify
        ? [
            { status: 'INITIATED', timestamp: new Date() },
            { status: 'VERIFIED', timestamp: new Date() },
          ]
        : [{ status: 'INITIATED', timestamp: new Date() }],
      initiatedAt: new Date(),
      ...(isAutoVerify && {
        utr: `AUTO-${Date.now()}`,
        bankVerifiedAt: new Date(),
        bankVerificationMethod: 'GATEWAY',
      }),
    });

    const savedPayment = await payment.save();

    this.auditService.log({
      action: 'PAYMENT_ESCROW_INITIATED',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: savedPayment._id as any,
      entityIdStr: savedPayment.paymentId,
      actorId: orgId,
      afterState: { paymentId: savedPayment.paymentId, orderId: dto.orderId, amount: order.pricing.grandTotal, method: dto.paymentMethod },
      description: `Payment ${savedPayment.paymentId} initiated for Order ${dto.orderId}`,
    });

    // For auto-verified payments (UPI / Netbanking sandbox), update order to PAID immediately
    if (isAutoVerify) {
      order.status = 'PAID';
      order.lifecycle.paidAt = new Date();
      order.payment = {
        paymentId: savedPayment.paymentId,
        paymentMethod: dto.paymentMethod,
        utr: `AUTO-${Date.now()}`,
        escrowHolds: order.pricing.grandTotal,
        escrowReleased: false,
      };
      await order.save();
    }

    return savedPayment;
  }

  async verifyUTR(paymentId: string, dto: VerifyUtrDto) {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    payment.utr = dto.utr;
    payment.status = 'VERIFIED';
    payment.bankVerifiedAt = new Date();
    payment.statusTimeline.push({ status: 'VERIFIED', timestamp: new Date() });
    await payment.save();

    // Update the order status to PAID with payment details
    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.status = 'PAID';
      order.lifecycle.paidAt = new Date();
      order.payment = {
        paymentId: payment.paymentId,
        paymentMethod: payment.paymentMethod,
        utr: dto.utr,
        escrowHolds: payment.escrowHoldAmount,
        escrowReleased: false,
      };
      await order.save();
    }

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

  async findAll(filter: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(
      Object.entries(filter).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return this.paymentModel
      .find(validFilters)
      .sort({ initiatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
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

  // ─── Staged Escrow Release ────────────────────────────────

  /**
   * Stage 1: Release 80% to seller when LR (Lorry Receipt) is uploaded
   */
  async releaseStage1(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) throw new NotFoundException('Payment not found for this order');
    if (payment.escrowStage1Status === 'RELEASED') return payment; // Idempotent

    payment.escrowStage1Status = 'RELEASED';
    payment.escrowStage1ReleasedAt = new Date();
    payment.statusTimeline.push({ status: 'STAGE1_RELEASED', timestamp: new Date() });
    await payment.save();

    this.auditService.log({
      action: 'ESCROW_STAGE1_RELEASED',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage1Status: 'RELEASED', amount: payment.escrowStage1Amount, orderId },
      description: `Escrow Stage 1 (80%) released for Order ${orderId} on LR upload`,
    });

    // Update order's escrow info
    const order = await this.orderModel.findById(orderId);
    if (order) {
      order.payment.escrowHolds = payment.escrowStage2Amount;
      await order.save();
    }

    return payment;
  }

  /**
   * Stage 2: Release remaining 20% to seller when buyer accepts delivery
   */
  async releaseStage2(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) throw new NotFoundException('Payment not found for this order');
    if (payment.escrowStage2Status === 'RELEASED') return payment; // Idempotent

    payment.escrowStage2Status = 'RELEASED';
    payment.escrowStage2ReleasedAt = new Date();
    payment.escrowHoldStatus = 'RELEASED';
    payment.escrowReleaseAt = new Date();
    payment.escrowReleaseReason = 'Buyer accepted delivery';
    payment.statusTimeline.push({ status: 'STAGE2_RELEASED', timestamp: new Date() });
    await payment.save();

    this.auditService.log({
      action: 'ESCROW_STAGE2_RELEASED',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage2Status: 'RELEASED', amount: payment.escrowStage2Amount, orderId },
      description: `Escrow Stage 2 (20%) fully released for Order ${orderId} — buyer accepted delivery`,
    });

    // Update order's escrow info
    const order = await this.orderModel.findById(orderId);
    if (order) {
      order.payment.escrowHolds = 0;
      order.payment.escrowReleased = true;
      order.payment.escrowReleasedAt = new Date();
      await order.save();
    }

    return payment;
  }

  /**
   * Hold Stage 2 when buyer raises a dispute — 20% stays in escrow
   */
  async holdStage2(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) throw new NotFoundException('Payment not found for this order');

    payment.escrowStage2Status = 'DISPUTED';
    payment.statusTimeline.push({ status: 'STAGE2_DISPUTED', timestamp: new Date() });
    const saved = await payment.save();

    this.auditService.log({
      action: 'ESCROW_STAGE2_HELD',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: saved._id as any,
      entityIdStr: saved.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage2Status: 'DISPUTED', amount: saved.escrowStage2Amount, orderId },
      description: `Escrow Stage 2 (20%) held pending dispute resolution for Order ${orderId}`,
      severity: 'WARNING',
    });

    return saved;
  }
}
