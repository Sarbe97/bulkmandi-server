import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DisputeDocument = Dispute & Document;

@Schema({ _id: false })
export class Evidence {
  @Prop({ required: true })
  evidenceId!: string;

  @Prop({ required: true })
  evidenceType!: string;

  @Prop()
  fileUrl?: string;

  @Prop()
  uploadedAt?: Date;

  @Prop()
  uploadedBy?: string;

  @Prop()
  description?: string;
}

@Schema({ timestamps: true })
export class Dispute {
  @Prop({ required: true, unique: true })
  disputeId!: string; // DSP-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shipment' })
  shipmentId?: Types.ObjectId;

  // Parties
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  claimantId!: Types.ObjectId;

  @Prop({ required: true })
  claimantRole!: string; // BUYER | SELLER

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  respondentId!: Types.ObjectId;

  @Prop({ required: true })
  respondentRole!: string;

  // Dispute details
  @Prop({ required: true })
  disputeType!: string; // SHORTAGE | QC_FAILURE | DOCS_MISSING | DAMAGE | OTHER

  @Prop({ required: true })
  claimValue!: number;

  @Prop()
  claimPercentage?: number;

  @Prop({ required: true })
  description!: string;

  // Evidence
  @Prop({ type: [Evidence], default: [] })
  evidence!: Evidence[];

  // Status & Resolution
  @Prop({ default: 'NEW' })
  status!: string; // NEW | IN_REVIEW | RESOLVED | CLOSED

  @Prop({ type: Array, default: [] })
  statusTimeline!: { status: string; timestamp: Date }[];

  @Prop()
  assignedTo?: string;

  @Prop()
  assignedAt?: Date;

  // Resolution
  @Prop({ type: Object })
  resolution?: {
    resolutionType?: string;
    decidedAt?: Date;
    decidedBy?: string;
    decisionNotes?: string;
    sellerRefund?: number;
    buyerCredit?: number;
  };

  // Timeline
  @Prop()
  raisedAt?: Date;

  @Prop()
  raisedBy?: string;

  @Prop()
  slaDeadline?: Date;

  @Prop()
  slaMet?: boolean;

  @Prop()
  resolvedAt?: Date;
}

export const DisputeSchema = SchemaFactory.createForClass(Dispute);

// DisputeSchema.index({ disputeId: 1 });
// DisputeSchema.index({ orderId: 1 });
DisputeSchema.index({ shipmentId: 1 });
DisputeSchema.index({ claimantId: 1, createdAt: -1 });
DisputeSchema.index({ status: 1, slaDeadline: 1 });
