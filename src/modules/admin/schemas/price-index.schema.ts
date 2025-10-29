import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PriceIndexDocument = PriceIndex & Document;

@Schema({ timestamps: true })
export class PriceIndex {
  @Prop({ required: true, unique: true })
  indexId!: string; // PI-HR-COILS-OD-751001

  @Prop({ required: true })
  productCategory!: string;

  @Prop({ required: true })
  productGrade!: string;

  @Prop({ required: true })
  region!: string;

  @Prop()
  pin?: string;

  @Prop()
  city?: string;

  @Prop({ required: true })
  liveIndex!: number;

  @Prop()
  previousClose?: number;

  @Prop()
  changePercent?: number;

  @Prop()
  quotesCount24h?: number;

  @Prop()
  lastUpdatedAt?: Date;
}

export const PriceIndexSchema = SchemaFactory.createForClass(PriceIndex);

// PriceIndexSchema.index({ indexId: 1 });
PriceIndexSchema.index({ productCategory: 1, productGrade: 1, pin: 1 });
