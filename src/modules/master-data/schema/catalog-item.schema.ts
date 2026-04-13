import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CatalogItemDocument = CatalogItem & Document;

@Schema({ timestamps: true })
export class CatalogItem {
  @Prop({ required: true })
  product_type: string; // e.g. "Primary TMT", "MS Billets"

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true, index: true })
  category: string; // e.g. "Mild Steel", "Non Ferrous"

  @Prop({ required: true, index: true })
  subcategory: string; // e.g. "Long Products", "Semi-Finished", "Flat Products"

  @Prop({ default: 0 })
  displayOrder: number;

  @Prop()
  image: string;

  @Prop()
  description: string;

  @Prop({ default: 'MT' })
  unit: string;

  @Prop()
  hsnCode: string;

  @Prop({ type: Object, default: {} })
  attributes: Record<string, any>; // e.g. { grade: ["Fe500","Fe500D"], size: ["8mm","12mm"], finish: [] }

  @Prop({ type: Object, default: {} })
  specifications: {
    is_lme_linked?: boolean;
    standard?: string;
    gst_rate?: number;
    min_order_quantity?: number;
  };

  @Prop({ type: Object, default: {} })
  technical_specs: Record<string, any>;

  @Prop({ default: false })
  showOnHome: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  search_keywords: string[];
}

export const CatalogItemSchema = SchemaFactory.createForClass(CatalogItem);

// Text index for search
CatalogItemSchema.index({ category: 'text', product_type: 'text', subcategory: 'text', description: 'text', search_keywords: 'text' });
