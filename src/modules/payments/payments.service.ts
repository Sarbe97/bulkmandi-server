import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyUtrDto } from './dto/verify-utr.dto';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService } from '../reports/reports.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { IdGeneratorService } from 'src/common/services/id-generator.service';
import { Inject, forwardRef } from '@nestjs/common';
import { AuditAction, AuditModule, AuditEntityType, LogisticsPreference } from 'src/common/constants/app.constants';
import { OrderStatus } from 'src/common/enums';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly reportsService: ReportsService,
    private readonly orgService: OrganizationsService,
    private readonly idGenerator: IdGeneratorService,
    @Inject(forwardRef(() => ShipmentsService)) private readonly shipmentsService: ShipmentsService,
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

    const buyerOrg = await this.orgService.getOrganization(orgId);
    const paymentId = this.idGenerator.generateBusinessId('PAY', buyerOrg?.orgCode);
    const isAutoVerify = dto.paymentMethod === 'UPI' || dto.paymentMethod === 'NETBANKING';

    // ✅ Dynamic Stage Calculation based on Payment Terms
    const terms = order.paymentTerms || '80/20 Escrow (Loading/POD)';
    let s1p = 80;
    let s2p = 20;

    if (terms === '100% Escrow (Full Advance)') {
      s1p = 100;
      s2p = 0;
    } else if (terms === '50/50 Escrow (Advance/Loading)') {
      s1p = 50;
      s2p = 50;
    }

    const payment = new this.paymentModel({
      paymentId,
      orderId: dto.orderId,
      amount: order.pricing.grandTotal,
      currency: 'INR',
      paymentMethod: dto.paymentMethod,
      escrowHoldAmount: order.pricing.grandTotal,
      escrowHoldStatus: 'ACTIVE',
      escrowStage1Percent: s1p,
      escrowStage2Percent: s2p,
      escrowStage1Amount: Math.round(order.pricing.grandTotal * (s1p / 100)),
      escrowStage2Amount: Math.round(order.pricing.grandTotal * (s2p / 100)),
      escrowStage1Status: 'PENDING',
      escrowStage2Status: 'PENDING',
      payerId: orgId,
      status: 'PENDING_VERIFICATION',
      statusTimeline: [{ status: 'INITIATED', timestamp: new Date() }, { status: 'PENDING_VERIFICATION', timestamp: new Date() }],
      initiatedAt: new Date(),
      ...(isAutoVerify && {
        utr: this.idGenerator.generateBusinessId('AUTO'),
        bankVerificationMethod: 'GATEWAY',
      }),
    });

    const savedPayment = await payment.save();

    this.auditService.log({
      action: AuditAction.PAYMENT_ESCROW_INITIATED,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: savedPayment._id as any,
      entityIdStr: savedPayment.paymentId,
      actorId: orgId,
      afterState: { paymentId: savedPayment.paymentId, orderId: dto.orderId, amount: order.pricing.grandTotal, method: dto.paymentMethod },
      description: `Payment ${savedPayment.paymentId} initiated for Order ${dto.orderId}`,
    });

    // For all initiated payments, update order to PAYMENT_SUBMITTED
    order.status = OrderStatus.PAYMENT_SUBMITTED;
    order.lifecycle.paymentPendingAt = new Date(); // Re-use or add paymentSubmittedAt
    order.payment = {
      paymentId: savedPayment.paymentId,
      paymentMethod: dto.paymentMethod,
      utr: isAutoVerify ? savedPayment.utr : undefined,
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
      order.status = OrderStatus.PAYMENT_SUBMITTED;
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
    payment.bankVerificationMethod = AuditEntityType.USER;
    payment.statusTimeline.push({ status: 'VERIFIED', timestamp: new Date() });
    await payment.save();

    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.status = OrderStatus.PAID;
      order.lifecycle.paidAt = new Date();
      order.payment.escrowHolds = payment.escrowHoldAmount;
      await order.save();

      // ✅ BUSINESS LOGIC: If term is '50/50 Escrow (Advance/Loading)', release Stage 1 (50%) IMMEDIATELY
      if (order.paymentTerms === '50/50 Escrow (Advance/Loading)') {
        try {
          await this.releaseStage1(order._id.toString());
          this.logger.log(`Auto-released Stage 1 Advance for Order ${order.orderId} (50/50 Term)`);
        } catch (err) {
          this.logger.error(`Failed to auto-release Advance for 50/50 term: ${err.message}`);
        }
      }

      // 🚫 DO NOT trigger ShipmentRFQ here. Payment verified ≠ goods ready.
      //    The Seller must explicitly click "Notify Material Ready" first.
      // ✅ ShipmentRFQ is created in: orders.service.ts → markDispatchReady() → createShipmentRfq()
      //    This ensures the Load Board is only populated AFTER the Seller confirms material readiness.
    }

    this.auditService.log({
      action: AuditAction.PAYMENT_VERIFIED_BY_ADMIN,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorId: adminId,
      afterState: { status: 'VERIFIED', orderId: payment.orderId },
      description: `Payment ${payment.paymentId} manually verified by Admin ${adminId}`,
    });

    // ✅ Notify Buyer & Seller using NEW branded template
    try {
      const { buffer, filename } = await this.reportsService.generateProformaInvoice(order.orderId);

      // 1. Notify Seller
      const sellerUsers = await this.notificationsService.notify(
        order.sellerId.toString(),
        "🚀 Payment Secured - Ready for Dispatch",
        `Payment for Order #${order.orderId} is now in Escrow.`,
        {
          template: "payment-received",
          data: {
            userName: "Seller Account", // notificationsService will overwrite with real name if userId found
            orderId: order.orderId,
            amount: payment.escrowHoldAmount.toLocaleString('en-IN'),
            orderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/seller/orders/${order._id}`,
          },
          category: AuditModule.PAYMENT,
        }
      );

      // 2. Notify Buyer
      await this.notificationsService.notify(
        order.buyerId.toString(),
        "✅ Payment Verified & Secured",
        `Your payment for Order #${order.orderId} has been successfully verified and is now held in BulkMandi Escrow.`,
        {
          template: "payment-received",
          data: {
            orderId: order.orderId,
            amount: payment.escrowHoldAmount.toLocaleString('en-IN'),
            orderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/buyer/orders/${order._id}`,
          },
          attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
          category: AuditModule.PAYMENT,
        }
      );
    } catch (notifyErr) {
      this.logger.error(`Failed to dispatch branded payment verification notifications: ${notifyErr.message}`);
    }

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
      // ✅ Revert to PAYMENT_PENDING so the buyer can re-submit with correct details
      order.status = OrderStatus.PAYMENT_PENDING;
      order.payment.utr = undefined;
      await order.save();

      // ✅ Notify Buyer about the rejection (inside the if-guard to prevent null refs)
      try {
        await this.notificationsService.notify(
          order.buyerId.toString(),
          "⚠️ Payment Rejected — Action Required",
          `Your payment for Order ${order.orderId} was rejected. Please re-submit with correct details.`,
          {
            template: "order-status",
            data: {
              orderId: order.orderId,
              status: "PAYMENT REJECTED",
              type: "PAYMENT ALERT",
              remarks: `${reason}. Please review and re-submit your payment.`,
              orderUrl: `${process.env.FRONTEND_URL}/buyer/orders/${order._id}`,
            },
            category: AuditModule.PAYMENT,
          }
        );
      } catch (notifyErr) {
        this.logger.error(`Failed to dispatch payment rejection notifications: ${notifyErr.message}`);
      }
    }

    this.auditService.log({
      action: AuditAction.PAYMENT_REJECTED_BY_ADMIN,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorId: adminId,
      afterState: { status: 'REJECTED', orderId: payment.orderId, reason },
      description: `Payment ${payment.paymentId} rejected by Admin ${adminId}. Order reverted to PAYMENT_PENDING. Reason: ${reason}`,
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
      action: AuditAction.ESCROW_STAGE1_RELEASED,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage1Status: 'RELEASED', amount: payment.escrowStage1Amount, orderId },
      description: `Escrow Stage 1 (${payment.escrowStage1Percent}%) released to seller for Order ${orderId}`,
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
      action: AuditAction.ESCROW_STAGE2_RELEASED,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment._id as any,
      entityIdStr: payment.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage2Status: 'RELEASED', amount: payment.escrowStage2Amount, orderId },
      description: `Escrow Stage 2 (${payment.escrowStage2Percent}%) fully released for Order ${orderId}`,
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
      action: AuditAction.ESCROW_STAGE2_HELD,
      module: AuditModule.PAYMENT,
      entityType: AuditEntityType.PAYMENT,
      entityId: saved._id as any,
      entityIdStr: saved.paymentId,
      actorType: 'SYSTEM',
      afterState: { escrowStage2Status: 'DISPUTED', amount: saved.escrowStage2Amount, orderId },
      description: `Escrow Stage 2 (${saved.escrowStage2Percent}%) held pending dispute resolution for Order ${orderId}`,
      severity: 'WARNING',
    });

    return saved;
  }
}
