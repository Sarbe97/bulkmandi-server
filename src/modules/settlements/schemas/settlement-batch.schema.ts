import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SettlementBatchDocument = SettlementBatch & Document;

@Schema({ _id: false })
export class LineItem {
  @Prop({ required: true })
  lineItemId!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  partyId!: Types.ObjectId;

  @Prop({ required: true })
  partyName!: string;

  @Prop({ required: true })
  partyType!: string; // SELLER | 3PL

  @Prop({ required: true })
  orderCount!: number;

  @Prop({ type: [String], required: true })
  orders!: string[];

  @Prop({ required: true })
  grossAmount!: number;

  @Prop({ default: 0 })
  platformFee!: number;

  @Prop({ default: 0 })
  disputeAdjustments!: number;

  @Prop({ required: true })
  netPayable!: number;

  @Prop({ default: 'READY' })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'Payout' })
  payoutId?: Types.ObjectId;

  @Prop()
  payoutAt?: Date;
}

@Schema({ timestamps: true })
export class SettlementBatch {
  @Prop({ required: true, unique: true })
  batchId!: string; // ST-2025-09A

  @Prop()
  batchName?: string;

  // Batch window
  @Prop({ type: Object, required: true })
  settlementWindow!: {
    windowType: string;
    windowDate: string;
    startDate: Date;
    endDate: Date;
  };

  // Orders included
  @Prop({ type: [Types.ObjectId], ref: 'Order', required: true })
  orderIds!: Types.ObjectId[];

  @Prop({ required: true })
  orderCount!: number;

  // Line items
  @Prop({ type: [LineItem], required: true })
  lineItems!: LineItem[];

  // Totals
  @Prop({ type: Object, required: true })
  totals!: {
    grossAmount: number;
    platformFees: number;
    disputeAdjustments: number;
    netPayable: number;
    lineItemCount: number;
  };

  // Status
  @Prop({ default: 'DRAFT' })
  status!: string; // DRAFT | READY | PROCESSING | PAID

  @Prop({ type: Array, default: [] })
  statusTimeline!: { status: string; timestamp: Date }[];

  @Prop()
  createdBy?: string;

  @Prop()
  payoutExecutedAt?: Date;
}

export const SettlementBatchSchema = SchemaFactory.createForClass(SettlementBatch);

// SettlementBatchSchema.index({ batchId: 1 });
SettlementBatchSchema.index({ status: 1, createdAt: -1 });
