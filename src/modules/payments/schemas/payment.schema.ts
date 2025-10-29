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
  amount!: number; // In paise

  @Prop({ default: 'INR' })
  currency!: string;

  @Prop({ required: true })
  paymentMethod!: string; // UPI | RTGS | NEFT | NETBANKING

  // Payment status
  @Prop({ default: 'INITIATED' })
  status!: string; // INITIATED | PENDING_VERIFICATION | VERIFIED | FAILED | REFUNDED

  @Prop({ type: Array, default: [] })
  statusTimeline!: { status: string; timestamp: Date }[];

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
