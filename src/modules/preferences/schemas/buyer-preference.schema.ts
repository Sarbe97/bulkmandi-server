import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type BuyerPreferenceDocument = BuyerPreference & Document;

@Schema({ timestamps: true })
export class BuyerPreference {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true })
  organizationId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop()
  typicalMonthlyVolumeMT?: number;

  @Prop({ type: [String], default: [] })
  incoterms: string[];

  @Prop({ type: [String], default: [] })
  deliveryPins: string[];

  @Prop()
  acceptanceWindow?: string;

  @Prop()
  qcRequirement?: string;

  @Prop({ default: false })
  notifyEmail: boolean;

  @Prop({ default: false })
  notifySMS: boolean;

  @Prop({ default: false })
  notifyWhatsApp: boolean;

  @Prop()
  notes?: string;
}

export const BuyerPreferenceSchema = SchemaFactory.createForClass(BuyerPreference);
