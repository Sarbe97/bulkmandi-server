import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

  @Prop({ type: String, enum: ['SUBMITTED', 'AWARDED', 'ACCEPTED', 'REJECTED'], default: 'SUBMITTED' })
  status!: string;
}

export const ShipmentBidSchema = SchemaFactory.createForClass(ShipmentBid);
ShipmentBidSchema.index({ srfqId: 1 });
ShipmentBidSchema.index({ carrierId: 1 });
ShipmentBidSchema.index({ status: 1 });
