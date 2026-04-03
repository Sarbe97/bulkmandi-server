import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SellerPreferenceDocument = SellerPreference & Document;

@Schema({ _id: false })
export class CatalogProduct {
  @Prop() category: string;
  @Prop() isSelected: boolean;
  @Prop({ type: [String] }) grades: string[];
  @Prop() moqPerOrder: number;
  @Prop() stdLeadTime: number;
  @Prop({ type: [String], default: [] }) availability: string[];
  @Prop() pricePerMT: number;
}

@Schema({ _id: false })
export class PlantLocation {
  @Prop() name?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() pincode?: string;
  @Prop() country?: string;
}

@Schema({ _id: false })
export class LogisticsPreference {
  @Prop({ default: true }) usePlatform3PL: boolean;
  @Prop({ default: false }) selfPickupAllowed: boolean;
}

@Schema({ timestamps: true })
export class SellerPreference {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true })
  organizationId: Types.ObjectId;

  @Prop({ type: [CatalogProduct], default: [] }) 
  catalogProducts: CatalogProduct[];

  @Prop({ type: [PlantLocation], default: [] }) 
  plantLocations: PlantLocation[];

  @Prop({ type: LogisticsPreference, default: () => ({}) }) 
  logisticsPreference: LogisticsPreference;
}

export const SellerPreferenceSchema = SchemaFactory.createForClass(SellerPreference);
