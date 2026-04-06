import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  organizationId?: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true, enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'] })
  type!: string;

  @Prop({ required: true, default: 'SYSTEM' })
  category!: string; // RFQ, ORDER, PAYMENT, KYC, etc.

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ default: false })
  isRead!: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ type: [String], default: ['IN_APP'] })
  channels!: string[]; // IN_APP, EMAIL, SMS, WHATSAPP

  @Prop()
  emailSentAt?: Date;

  @Prop()
  smsSentAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
