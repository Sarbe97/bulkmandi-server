import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  logId!: string; // AUD-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ default: 'USER' })
  actorType!: string; // USER | SYSTEM | SERVICE

  @Prop({ required: true })
  action!: string; // CREATE | UPDATE | DELETE | APPROVE | REJECT

  @Prop({ required: true })
  entityType!: string; // RFQ | ORDER | PAYMENT | etc.

  @Prop({ type: Types.ObjectId })
  entityId?: Types.ObjectId;

  @Prop()
  entityIdStr?: string;

  @Prop({ type: Object })
  beforeState?: any;

  @Prop({ type: Object })
  afterState?: any;

  @Prop({ type: [String], default: [] })
  changedFields!: string[];

  @Prop()
  userIp?: string;

  @Prop()
  description?: string;

  @Prop({ default: 'INFO' })
  severity!: string; // INFO | WARNING | ERROR

  @Prop({ required: true })
  timestamp!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ entityId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
