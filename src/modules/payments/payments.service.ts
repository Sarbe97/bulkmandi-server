import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
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
    private readonly logger: CustomLoggerService,
  ) {}

  async create(orgId: string, dto: CreatePaymentDto) {
    this.logger.log(`Initiating payment for order: ${dto.orderId} by buyer: ${orgId}`);
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId.toString() !== orgId) throw new BadRequestException('This order does not belong to you');
    const existing = await this.paymentModel.findOne({ orderId: dto.orderId });
    if (existing && existing.status !== 'REJECTED' && existing.status !== 'CANCELLED') {
      throw new BadRequestException('Payment already initiated');
    }

    // If existing exists but is REJECTED/CANCELLED, we can proceed to create a new one (or we could update, but create new with fresh ID is cleaner for tracking)

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
      status: 'PENDING_VERIFICATION',
      statusTimeline: [{ status: 'INITIATED', timestamp: new Date() }, { status: 'PENDING_VERIFICATION', timestamp: new Date() }],
      initiatedAt: new Date(),
      ...(isAutoVerify && {
        utr: `AUTO-${Date.now()}`,
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

    // For all initiated payments, update order to PAYMENT_SUBMITTED
    order.status = 'PAYMENT_SUBMITTED';
    order.lifecycle.paymentPendingAt = new Date(); // Re-use or add paymentSubmittedAt
    order.payment = {
      paymentId: savedPayment.paymentId,
      paymentMethod: dto.paymentMethod,
      utr: isAutoVerify ? `AUTO-${Date.now()}` : undefined,
      escrowHolds: order.pricing.grandTotal,
      escrowReleased: false,
    };
    await order.save();

    return savedPayment;
  }

  async verifyUTR(paymentId: string, dto: VerifyUtrDto) {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    payment.utr = dto.utr;
    payment.status = 'PENDING_VERIFICATION';
    payment.statusTimeline.push({ status: 'PENDING_VERIFICATION', timestamp: new Date() });
    await payment.save();

    // Update the order status to PAYMENT_SUBMITTED
    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.status = 'PAYMENT_SUBMITTED';
      order.payment.utr = dto.utr;
      await order.save();
    }

    return payment;
  }

  async adminVerifyPayment(paymentId: string, adminId: string) {
    this.logger.log(`Admin ${adminId} verifying payment: ${paymentId}`);
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    
    payment.status = 'VERIFIED';
    payment.bankVerifiedAt = new Date();
    payment.bankVerificationMethod = 'ADMIN_MANUAL';
    payment.statusTimeline.push({ status: 'VERIFIED', timestamp: new Date() });
    await payment.save();

    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.status = 'PAID';
      order.lifecycle.paidAt = new Date();
      order.payment.escrowHolds = payment.escrowHoldAmount;
      await order.save();
    }

    this.auditService.log({
      action: 'PAYMENT_VERIFIED_BY_ADMIN',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorId: adminId,
      afterState: { status: 'VERIFIED', orderId: payment.orderId },
      description: `Payment ${payment.paymentId} manually verified by Admin ${adminId}`,
    });

    return payment;
  }

  async adminRejectPayment(paymentId: string, adminId: string, reason: string) {
    this.logger.log(`Admin ${adminId} rejecting payment: ${paymentId}. Reason: ${reason}`);
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new NotFoundException('Payment record not found');
    
    payment.status = 'REJECTED';
    payment.statusTimeline.push({ status: 'REJECTED', timestamp: new Date(), reason });
    // Reset UTR so buyer can re-submit
    payment.utr = undefined;
    await payment.save();

    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.status = 'REJECTED';
      order.payment.utr = undefined;
      await order.save();
    }

    this.auditService.log({
      action: 'PAYMENT_REJECTED_BY_ADMIN',
      module: 'PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorId: adminId,
      afterState: { status: 'REJECTED', orderId: payment.orderId, reason },
      description: `Payment ${payment.paymentId} rejected by Admin ${adminId}. Reason: ${reason}`,
    });

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
