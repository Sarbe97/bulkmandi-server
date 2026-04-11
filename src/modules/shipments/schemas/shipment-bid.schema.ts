import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ShipmentBidStatus } from 'src/common/enums';

export type ShipmentBidDocument = ShipmentBid & Document;

@Schema({ timestamps: true })
export class ShipmentBid {
  @Prop({ type: Types.ObjectId, ref: 'ShipmentRfq', required: true })
  srfqId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  carrierId!: Types.ObjectId;

  @Prop({ required: true })
  carrierName!: string;

  @Prop({ required: true, type: Number })
  amount!: number;

  @Prop({ required: true })
  transitTimeDays!: number;

  @Prop({ required: true })
  vehicleType!: string;

  @Prop()
  notes?: string;

  // ✅ Uses enum to stay in sync — adding a new status to the enum auto-updates the schema
  @Prop({ type: String, enum: Object.values(ShipmentBidStatus), default: ShipmentBidStatus.SUBMITTED })
  status!: string;
}

export const ShipmentBidSchema = SchemaFactory.createForClass(ShipmentBid);
ShipmentBidSchema.index({ srfqId: 1 });
ShipmentBidSchema.index({ carrierId: 1 });
ShipmentBidSchema.index({ status: 1 });

