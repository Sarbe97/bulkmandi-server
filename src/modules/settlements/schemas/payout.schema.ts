import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PayoutDocument = Payout & Document;

@Schema({ timestamps: true })
export class Payout {
  @Prop({ required: true, unique: true })
  payoutId!: string; // PAYOUT-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'SettlementBatch', required: true })
  batchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  payeeId!: Types.ObjectId;

  @Prop({ required: true })
  payeeName!: string;

  @Prop({ required: true })
  payeeType!: string; // SELLER | 3PL

  // Amounts
  @Prop({ required: true })
  grossAmount!: number;

  @Prop({ type: Object, required: true })
  deductions!: {
    platformFee: number;
    taxes: number;
    disputeAdjustments: number;
  };

  @Prop({ required: true })
  netPayable!: number;

  @Prop({ default: 'INR' })
  currency!: string;

  // Payout details
  @Prop({ required: true })
  payoutMethod!: string; // RTGS | NEFT | IMPS

  @Prop({ type: Object, required: true })
  bankDetails!: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
  };

  // Execution
  @Prop({ default: 'INITIATED' })
  status!: string; // INITIATED | PROCESSING | SENT | CONFIRMED | FAILED

  @Prop()
  initiatedAt?: Date;

  @Prop()
  sentAt?: Date;

  @Prop()
  confirmedAt?: Date;

  // Bank response
  @Prop()
  bankReference?: string;

  @Prop({ type: [String], default: [] })
  utrs!: string[];

  // Reconciliation
  @Prop({ default: false })
  reconciled!: boolean;

  @Prop()
  reconciledAt?: Date;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);

// PayoutSchema.index({ payoutId: 1 });
PayoutSchema.index({ batchId: 1 });
PayoutSchema.index({ payeeId: 1, status: 1 });
