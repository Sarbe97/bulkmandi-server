import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NegotiationDocument = Negotiation & Document;

// ── Sub-document: one round of counter-offer ──
@Schema({ _id: false, timestamps: false })
export class NegotiationRound {
  @Prop({ required: true })
  roundNumber!: number;

  @Prop({ required: true, enum: ['BUYER', 'SELLER'] })
  actor!: string; // who made this offer

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  actorOrgId!: Types.ObjectId;

  @Prop({ required: true })
  pricePerMT!: number;

  @Prop({ required: true })
  freightPerMT!: number;

  @Prop({ required: true })
  quantityMT!: number;

  @Prop({ required: true })
  leadDays!: number;

  @Prop()
  paymentTerms?: string;

  @Prop()
  notes?: string;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}

export const NegotiationRoundSchema = SchemaFactory.createForClass(NegotiationRound);

// ── Main Negotiation document ──
@Schema({ timestamps: true })
export class Negotiation {
  @Prop({ required: true, unique: true })
  negotiationId!: string; // NEG-{timestamp}

  @Prop({ required: true })
  quoteId!: string; // FK → Quote.quoteId

  @Prop({ required: true })
  rfqId!: string; // FK → Rfq.rfqId

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ required: true })
  buyerOrgName!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  sellerOrgName!: string;

  @Prop({
    required: true,
    enum: ['BUYER_COUNTERED', 'SELLER_COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    default: 'BUYER_COUNTERED',
  })
  status!: string;

  @Prop({ type: [NegotiationRoundSchema], default: [] })
  rounds!: NegotiationRound[];

  @Prop({ default: 1 })
  currentRound!: number;

  @Prop({ default: 5 })
  maxRounds!: number;

  @Prop()
  expiresAt?: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

export const NegotiationSchema = SchemaFactory.createForClass(Negotiation);

NegotiationSchema.index({ quoteId: 1, status: 1 });
NegotiationSchema.index({ rfqId: 1 });
NegotiationSchema.index({ buyerId: 1, createdAt: -1 });
NegotiationSchema.index({ sellerId: 1, createdAt: -1 });
