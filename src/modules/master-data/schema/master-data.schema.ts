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

@Schema({ _id: false })
export class QuoteDeviationConfig {
  /** Level 1: Soft Warning (UI only) — deviation above this triggers a warning banner */
  @Prop({ default: 0.4 })
  warningThreshold: number; // 40%

  /** Level 2: Justification Required — submission blocked without priceJustification field */
  @Prop({ default: 1.0 })
  justificationThreshold: number; // 100%

  /** Level 3: Hard Block — submission is unconditionally rejected */
  @Prop({ default: 2.0 })
  blockThreshold: number; // 200%
}
const QuoteDeviationConfigSchema = SchemaFactory.createForClass(QuoteDeviationConfig);

@Schema({ _id: false })
export class PlatformConfig {
  /** Platform commission rate deducted from each settlement batch (as decimal, e.g. 0.02 = 2%) */
  @Prop({ default: 0.02 })
  platformFeeRate: number;

  /** Settlement window in banking days (T+N) */
  @Prop({ default: 2 })
  settlementWindowDays: number;

  /** Quote price deviation guardrails vs catalog benchmark */
  @Prop({ type: QuoteDeviationConfigSchema, default: () => ({}) })
  quoteDeviation: QuoteDeviationConfig;

  /** Allowed payment terms presented in the Quote Form (Phase-1 only) */
  @Prop({ type: [String], default: [
    '80/20 Escrow (Loading/POD)',
    '100% Escrow (Full Advance)',
    '50/50 Escrow (Advance/Loading)',
  ]})
  allowedPaymentTerms: string[];
}
const PlatformConfigSchema = SchemaFactory.createForClass(PlatformConfig);

@Schema({ timestamps: true })
export class MasterData {
    @Prop({ type: [FleetTypeItemSchema], default: [] })
    fleetTypes: FleetTypeItem[];

    @Prop({ type: [ProductCategoryItemSchema], default: [] })
    productCategories: ProductCategoryItem[];

    @Prop({ type: EscrowAccountSchema, default: () => ({}) })
    escrowAccount: EscrowAccount;

    @Prop({ type: PlatformConfigSchema, default: () => ({}) })
    platformConfig: PlatformConfig;
}

export const MasterDataSchema = SchemaFactory.createForClass(MasterData);
