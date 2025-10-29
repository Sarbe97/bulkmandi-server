import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuoteDocument = Quote & Document;

@Schema({ timestamps: true })
export class Quote {
  @Prop({ required: true, unique: true })
  quoteId!: string; // QUOTE-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Rfq', required: true })
  rfqId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  sellerOrgName!: string;

  @Prop()
  sellerPlant?: string;

  @Prop()
  sellerPlantPin?: string;

  // Pricing
  @Prop({ required: true })
  pricePerMT!: number;

  @Prop({ required: true })
  totalPriceBase!: number;

  @Prop({ required: true })
  freightPerMT!: number;

  @Prop({ required: true })
  totalFreight!: number;

  @Prop()
  taxesPerMT?: number;

  @Prop()
  totalTaxes?: number;

  @Prop({ required: true })
  grandTotal!: number;

  @Prop({ default: 'INR' })
  currency!: string;

  // Terms
  @Prop({ required: true })
  leadDays!: number;

  @Prop({ required: true })
  validityHours!: number;

  @Prop()
  validityExpiresAt?: Date;

  // Price floor checks
  @Prop({ default: false })
  floorApplied!: boolean;

  @Prop()
  priceFloorValue?: number;

  @Prop({ default: true })
  priceFloorMet!: boolean;

  // Notes
  @Prop()
  notes?: string;

  // Status
  @Prop({ default: 'ACTIVE' })
  status!: string; // ACTIVE | EXPIRED | WITHDRAWN | ACCEPTED | REJECTED

  @Prop()
  submittedAt?: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  acceptedBy?: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

// QuoteSchema.index({ quoteId: 1 });
QuoteSchema.index({ rfqId: 1 });
QuoteSchema.index({ sellerId: 1, createdAt: -1 });
QuoteSchema.index({ status: 1, validityExpiresAt: 1 });
