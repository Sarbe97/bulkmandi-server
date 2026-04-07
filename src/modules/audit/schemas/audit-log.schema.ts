import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

/**
 * Supported action values (non-exhaustive, stored as string for extensibility):
 * AUTH:   USER_LOGIN | USER_REGISTER | LOGIN_FAILED | TOKEN_REFRESHED
 * RFQ:    RFQ_CREATED | RFQ_PUBLISHED | RFQ_UPDATED | RFQ_CLOSED | RFQ_DELETED
 * QUOTE:  QUOTE_SUBMITTED | QUOTE_ACCEPTED | QUOTE_WITHDRAWN | QUOTE_UPDATED
 * ORDER:  ORDER_CREATED | ORDER_STATUS_CHANGED | ORDER_CANCELLED | DELIVERY_ACCEPTED | DELIVERY_DISPUTED
 * SHIP:   SHIPMENT_CREATED | MILESTONE_ADDED | DOCUMENT_UPLOADED | POD_UPLOADED | SHIPMENT_DELIVERED
 * KYC:    KYC_APPROVED | KYC_REJECTED | KYC_INFO_REQUESTED | KYC_WATCHLISTED | KYC_UNLOCKED
 * PAY:    ESCROW_STAGE1_RELEASED | ESCROW_STAGE2_RELEASED | ESCROW_STAGE2_HELD
 * SETTLE: SETTLEMENT_CREATED | SETTLEMENT_PAID
 */
@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  /** Human-readable ID, e.g. AUD-1711700000000-a3f2 */
  @Prop({ required: true, index: true })
  logId!: string;

  /** The user who performed the action */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  /** USER | SYSTEM | SERVICE */
  @Prop({ default: 'USER' })
  actorType!: string;

  /** e.g. RFQ_CREATED, KYC_APPROVED */
  @Prop({ required: true })
  action!: string;

  /** Business domain: AUTH | RFQ | QUOTE | ORDER | SHIPMENT | KYC | PAYMENT | SETTLEMENT | ORG */
  @Prop({ required: true })
  module!: string;

  /** Entity type: RFQ | ORDER | SHIPMENT | KYC_CASE | PAYMENT | QUOTE | USER | ORG */
  @Prop({ required: true })
  entityType!: string;

  @Prop({ type: Types.ObjectId })
  entityId?: Types.ObjectId;

  /** String form of the entity ID (e.g. RFQ-1711700000000, ORD-xxx) */
  @Prop()
  entityIdStr?: string;

  /** Snapshot of changed fields BEFORE the action (only changed fields, not full doc) */
  @Prop({ type: Object })
  beforeState?: Record<string, any>;

  /** Snapshot of changed fields AFTER the action */
  @Prop({ type: Object })
  afterState?: Record<string, any>;

  /** List of field names that changed */
  @Prop({ type: [String], default: [] })
  changedFields!: string[];

  /** Users who should see this action in their activity/notifications */
  @Prop({ type: [Types.ObjectId], ref: 'User', index: true })
  targetUserIds?: Types.ObjectId[];

  /** Organizations who should see this activity */
  @Prop({ type: [Types.ObjectId], ref: 'Organization', index: true })
  targetOrgIds?: Types.ObjectId[];

  @Prop()
  userIp?: string;

  /** Human-readable summary, e.g. 'RFQ RFQ-123 published by buyer org XYZ' */
  @Prop()
  description?: string;

  /** INFO | WARNING | ERROR */
  @Prop({ default: 'INFO' })
  severity!: string;

  @Prop({ required: true })
  timestamp!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Per-entity trail (most common query)
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
// Per-actor activity
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
// Module + action filtering (admin dashboard)
AuditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
// Time-based listing
AuditLogSchema.index({ createdAt: -1 });
