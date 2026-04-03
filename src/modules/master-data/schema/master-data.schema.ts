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

@Schema()
export class EscrowAccount {
    @Prop({ required: true, default: 'BulkMandi Escrow Services' })
    beneficiaryName: string;

    @Prop({ required: true, default: 'ICICI Bank' })
    bankName: string;

    @Prop({ required: true, default: '000000000000' })
    accountNumber: string;

    @Prop({ required: true, default: 'ICIC0000000' })
    ifscCode: string;

    @Prop({ default: 'Mumbai Main' })
    branchName: string;
}
const EscrowAccountSchema = SchemaFactory.createForClass(EscrowAccount);

@Schema({ timestamps: true })
export class MasterData {
    @Prop({ type: [FleetTypeItemSchema], default: [] })
    fleetTypes: FleetTypeItem[];

    @Prop({ type: [ProductCategoryItemSchema], default: [] })
    productCategories: ProductCategoryItem[];

    @Prop({ type: EscrowAccountSchema, default: () => ({}) })
    escrowAccount: EscrowAccount;
}

export const MasterDataSchema = SchemaFactory.createForClass(MasterData);
