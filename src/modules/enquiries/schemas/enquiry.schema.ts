import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EnquiryType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum EnquiryStatus {
  NEW = 'NEW',
  MATCHED = 'MATCHED',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED', // To RFQ or Listing
  CLOSED = 'CLOSED',
  SPAM = 'SPAM',
}

export type EnquiryDocument = Enquiry & Document;

@Schema({ timestamps: true })
export class Enquiry {
  @Prop({ required: true, enum: EnquiryType })
  enquiryType: EnquiryType;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, index: true })
  mobile: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true, index: true })
  productSlug: string;

  @Prop({ required: true })
  productName: string;

  // Intent Specific - BUY
  @Prop()
  quantityMT?: number;

  @Prop()
  deliveryLocation?: string;

  @Prop()
  timeline?: string; // urgent | flexible

  // Intent Specific - SELL
  @Prop()
  availableStock?: number;

  @Prop()
  materialLocation?: string;

  @Prop()
  expectedPrice?: number;

  @Prop({ type: Object })
  attributes?: Record<string, any>;

  @Prop()
  message?: string;

  @Prop({ required: true, enum: EnquiryStatus, default: EnquiryStatus.NEW })
  status: EnquiryStatus;

  @Prop({ default: 'PUBLIC' })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Object, default: { callClicks: 0, whatsappClicks: 0 } })
  actionMetrics: {
    callClicks: number;
    whatsappClicks: number;
  };
}

export const EnquirySchema = SchemaFactory.createForClass(Enquiry);

EnquirySchema.index({ enquiryType: 1, status: 1 });
EnquirySchema.index({ createdAt: -1 });
