import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true })
  paymentId!: string; // PAY-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  amount!: number; // In whole Rupees

  @Prop({ default: 'INR' })
  currency!: string;

  @Prop({ required: true })
  paymentMethod!: string; // UPI | RTGS | NEFT | NETBANKING

  // Payment status
  @Prop({ default: 'INITIATED' })
  status!: string; // INITIATED | PENDING_VERIFICATION | VERIFIED | FAILED | REFUNDED

  @Prop({ type: Array, default: [] })
  statusTimeline!: { status: string; timestamp: Date; reason?: string }[];

  // Bank tracking
  @Prop()
  utr?: string;

  @Prop()
  bankReference?: string;

  @Prop()
  bankResponseCode?: string;

  @Prop()
  bankResponseMessage?: string;

  @Prop()
  bankVerifiedAt?: Date;

  @Prop({ default: 'MANUAL' })
  bankVerificationMethod!: string;

  // Escrow hold
  @Prop()
  escrowHoldId?: string;

  @Prop({ required: true })
  escrowHoldAmount!: number;

  @Prop({ default: 'ACTIVE' })
  escrowHoldStatus!: string; // ACTIVE | RELEASED | CANCELLED

  @Prop()
  escrowReleaseAt?: Date;

  @Prop()
  escrowReleaseReason?: string;

  // Escrow staged release (80% on LR, 20% on POD acceptance)
  @Prop({ default: 80 })
  escrowStage1Percent!: number;

  @Prop({ default: 20 })
  escrowStage2Percent!: number;

  @Prop({ default: 0 })
  escrowStage1Amount!: number;

  @Prop({ default: 0 })
  escrowStage2Amount!: number;

  @Prop({ default: 'PENDING' })
  escrowStage1Status!: string; // PENDING | RELEASED

  @Prop({ default: 'PENDING' })
  escrowStage2Status!: string; // PENDING | RELEASED | DISPUTED

  @Prop()
  escrowStage1ReleasedAt?: Date;

  @Prop()
  escrowStage2ReleasedAt?: Date;

  // Payer/Payee
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  payerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  payeeId?: Types.ObjectId;

  @Prop()
  initiatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ payerId: 1, status: 1 });
PaymentSchema.index({ utr: 1 });
PaymentSchema.index({ status: 1 });
