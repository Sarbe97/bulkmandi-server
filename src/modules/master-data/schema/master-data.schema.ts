import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MasterDataDocument = MasterData & Document;

@Schema()
export class FleetTypeItem {
    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    label: string;
}
const FleetTypeItemSchema = SchemaFactory.createForClass(FleetTypeItem);

@Schema()
export class ProductCategoryItem {
    @Prop({ required: true })
    name: string; // e.g. "HR Coils"

    @Prop({ type: [String], default: [] })
    grades: string[]; // e.g. ["IS 2062 E250", ...]
}
const ProductCategoryItemSchema = SchemaFactory.createForClass(ProductCategoryItem);

@Schema({ timestamps: true })
export class MasterData {
    @Prop({ type: [FleetTypeItemSchema], default: [] })
    fleetTypes: FleetTypeItem[];

    @Prop({ type: [ProductCategoryItemSchema], default: [] })
    productCategories: ProductCategoryItem[];
}

export const MasterDataSchema = SchemaFactory.createForClass(MasterData);
