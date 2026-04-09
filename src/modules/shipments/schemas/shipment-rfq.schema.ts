import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ShipmentRfqStatus } from 'src/common/enums';

export type ShipmentRfqDocument = ShipmentRfq & Document;

@Schema({ timestamps: true })
export class ShipmentRfq {
  @Prop({ required: true, unique: true })
  rfqId!: string; // SRFQ-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  originPin!: string;

  @Prop({ required: true })
  destinationPin!: string;

  @Prop({ type: Object, required: true })
  materialDetails!: {
    category: string;
    grade: string;
    quantityMT: number;
  };

  @Prop()
  requiredVehicleType?: string;

  @Prop({ required: true })
  expectedPickupDate!: Date;

  @Prop({ type: String, enum: Object.values(ShipmentRfqStatus), default: ShipmentRfqStatus.OPEN })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'ShipmentBid' })
  winningBidId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  assignedCarrierId?: Types.ObjectId;

  @Prop()
  awardedAt?: Date;

  @Prop()
  acceptanceTimeout?: Date;

  @Prop()
  rejectionReason?: string;
}


export const ShipmentRfqSchema = SchemaFactory.createForClass(ShipmentRfq);
ShipmentRfqSchema.index({ status: 1 });
ShipmentRfqSchema.index({ orderId: 1 });
ShipmentRfqSchema.index({ originPin: 1 });
