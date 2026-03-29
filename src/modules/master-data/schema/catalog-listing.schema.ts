import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CatalogItem } from './catalog-item.schema';

export type CatalogListingDocument = CatalogListing & Document;

@Schema({ _id: false })
export class PriceHistoryEntry {
  @Prop({ required: true })
  price: number;

  @Prop({ default: () => new Date() })
  date: Date;

  @Prop()
  source: string;
}

export const PriceHistoryEntrySchema = SchemaFactory.createForClass(PriceHistoryEntry);

@Schema({ timestamps: true })
export class CatalogListing {
  @Prop({ unique: true })
  uniqueKey: string;

  @Prop({ type: Types.ObjectId, ref: CatalogItem.name, required: true, index: true })
  catalogItemId: Types.ObjectId;

  @Prop({ required: true, index: true })
  catalogItemSlug: string;

  @Prop({ required: true, index: true })
  supplier_name: string;

  @Prop({ required: true, index: true })
  brand: string;

  @Prop({ required: true, index: true })
  city: string;

  @Prop({ required: true })
  basePrice: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ default: 0 })
  stockQty: number;

  @Prop({ default: 1 })
  moq: number;

  @Prop({ type: Object, required: true })
  attributes: Record<string, string>;

  @Prop()
  lead_time: number;

  @Prop({ type: [PriceHistoryEntrySchema], default: [] })
  priceHistory: PriceHistoryEntry[];

  @Prop({ default: true })
  isActive: boolean;
}

export const CatalogListingSchema = SchemaFactory.createForClass(CatalogListing);

// High-performance filtering index for the platform
CatalogListingSchema.index({
  catalogItemSlug: 1,
  city: 1,
  isActive: 1,
  'attributes.grade': 1,
  'attributes.size': 1
});


// Pricing filter performance index
CatalogListingSchema.index({ basePrice: 1 });
