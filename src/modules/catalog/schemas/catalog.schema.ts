import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CatalogDocument = Catalog & Document;

@Schema({ _id: false })
export class Grade {
  @Prop({ required: true })
  code!: string; // IS2062_E250

  @Prop({ required: true })
  name!: string; // IS 2062 Grade E250

  @Prop()
  description?: string;
}

// @Schema({ _id: false })
// export class PriceFloor {
//   @Prop({ required: true })
//   category!: string;
//
//   @Prop({ required: true })
//   grade!: string;
//
//   @Prop({ required: true })
//   pricePerMT!: number;
//
//   @Prop()
//   effectiveFrom?: Date;
// }

@Schema({ _id: false })
export class PlantLocation {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  pincode!: string;

  @Prop()
  address?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ default: true })
  isActive!: boolean;
}

@Schema({ timestamps: true })
export class Catalog {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true })
  orgName!: string;

  @Prop({ type: [String], required: true })
  categories!: string[]; // ['HR_COILS', 'TMT_BARS', 'PLATES']

  @Prop({ type: [Grade], default: [] })
  grades!: Grade[];

  // @Prop({ type: [PriceFloor], default: [] })
  // priceFloors!: PriceFloor[];

  @Prop({ type: Object, default: {} })
  pricePerCategory!: Record<string, number>; // { "HR_COILS": 45000 }

  @Prop({ type: [PlantLocation], default: [] })
  plantLocations!: PlantLocation[];

  @Prop({ type: Object, default: {} })
  moqPerCategory!: Record<string, number>; // { "HR_COILS": 50 }

  @Prop({ type: Object, default: {} })
  leadTimePerCategory!: Record<string, number>; // { "HR_COILS": 3 }

  @Prop({ default: 'ACTIVE' })
  status!: string;
}

export const CatalogSchema = SchemaFactory.createForClass(Catalog);

// CatalogSchema.index({ organizationId: 1 });
CatalogSchema.index({ categories: 1 });
