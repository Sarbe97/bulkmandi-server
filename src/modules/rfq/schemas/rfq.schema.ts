import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RfqDocument = Rfq & Document;

@Schema({ _id: false })
export class Product {
  @Prop({ required: true })
  category!: string; // STEEL | COAL

  @Prop()
  subCategory?: string; // HR_COILS | TMT_BARS

  @Prop({ required: true })
  grade!: string; // IS2062_E250

  @Prop()
  size?: string;

  @Prop()
  tolerance?: string;

  @Prop({ default: false })
  millTcRequired!: boolean;
}

@Schema({ _id: false })
export class SellerMatch {
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  sellerId?: Types.ObjectId;

  @Prop()
  sellerName?: string;

  @Prop()
  fitScore?: number;

  @Prop()
  estimatedPrice?: number;
}

@Schema({ timestamps: true })
export class Rfq {
  @Prop({ required: true, unique: true })
  rfqId!: string; // RFQ-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ required: true })
  buyerOrgName!: string;

  // Product details
  @Prop({ type: Product, required: true })
  product!: Product;

  // Quantity & Location
  @Prop({ required: true })
  quantityMT!: number;

  @Prop({ required: true })
  targetPin!: string;

  @Prop()
  targetCity?: string;

  @Prop()
  targetState?: string;

  @Prop({ required: true })
  deliveryBy!: Date;

  // Incoterms
  @Prop({ required: true })
  incoterm!: string; // DAP | FOB | CIF | EXW

  // Notes
  @Prop()
  notes?: string;

  @Prop({ type: [String], default: [] })
  attachments!: string[];

  // System insights (auto-generated)
  @Prop({ type: Object })
  systemInsights?: {
    specNormalized?: boolean;
    normalizedAt?: Date;
    freightEstimated?: boolean;
    freightEstimatePerMT?: number;
    sellerMatches?: SellerMatch[];
    priceIndex?: {
      category: string;
      liveIndex: number;
      lastUpdated: Date;
    };
  };

  // Quote tracking
  @Prop({ type: [Types.ObjectId], ref: 'Quote', default: [] })
  quoteIds!: Types.ObjectId[];

  @Prop({ default: 0 })
  quotesCount!: number;

  // Status
  @Prop({ default: 'DRAFT' })
  status!: string; // DRAFT | OPEN | EXPIRED | WON | CLOSED

  @Prop()
  publishedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  wonOrderId?: Types.ObjectId;
}

export const RfqSchema = SchemaFactory.createForClass(Rfq);

// RfqSchema.index({ rfqId: 1 });
RfqSchema.index({ buyerId: 1, createdAt: -1 });
RfqSchema.index({ status: 1, expiresAt: 1 });
RfqSchema.index({ 'product.category': 1, 'product.grade': 1 });
RfqSchema.index({ targetPin: 1 });
RfqSchema.index({ publishedAt: -1 });
