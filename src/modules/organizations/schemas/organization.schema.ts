import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from 'src/common/enums';

export type OrganizationDocument = Organization & Document;

@Schema({ _id: false })
export class Address {
  @Prop() street?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() pin?: string;
  @Prop() country?: string;
}

@Schema({ _id: false })
export class Contact {
  @Prop() name?: string;
  @Prop() email?: string;
  @Prop() mobile?: string;
  @Prop() role?: string;
}

@Schema({ _id: false })
export class BankDocument {
  @Prop() type?: string;
  @Prop() fileName?: string;
  @Prop() fileUrl?: string;
  @Prop({ type: Date }) uploadedAt?: Date;
  @Prop() status?: string;
}

@Schema({ _id: false })
export class BankAccount {
  @Prop() accountNumber?: string;
  @Prop() ifsc?: string;
  @Prop() bankName?: string;
  @Prop() accountHolderName?: string;
  @Prop() accountType?: string;
  @Prop() pennyDropStatus?: string;
  @Prop() pennyDropScore?: number;
  @Prop({ type: [BankDocument], default: [] }) documents?: BankDocument[];
}

@Schema({ _id: false })
export class OrgKyc {
  @Prop() legalName?: string;
  @Prop() tradeName?: string;
  @Prop() gstin?: string;
  @Prop() pan?: string;
  @Prop() registeredAddress?: string;
  @Prop() businessType?: string;
  @Prop() incorporationDate?: string;
  @Prop({ type: [Address], default: [] }) plantLocations?: Address[];
  @Prop({ type: Contact }) primaryContact?: Contact;
  @Prop({ type: Contact }) secondaryContact?: Contact;
}

@Schema({ _id: false })
export class CatalogProduct {
  @Prop() category: string;
  @Prop() isSelected: boolean;
  @Prop() grades: string[];
  @Prop() moqPerOrder: number;
  @Prop() stdLeadTime: number;
}

@Schema({ _id: false })
export class PriceFloor {
  @Prop() category: string;
  @Prop() pricePerMT: number;
}

@Schema({ _id: false })
export class ComplianceDocument {
  @Prop() type: string;
  @Prop() fileName: string;
  @Prop() fileUrl: string;
  @Prop({ type: Date }) uploadedAt: Date;
  @Prop() status: string;
}

@Schema({ _id: false })
export class LogisticsPreference {
  @Prop() usePlatform3PL: boolean;
  @Prop() selfPickupAllowed: boolean;
}

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: false, unique: true })
  orgId?: string;

  @Prop({ required: true })
  legalName!: string;

  @Prop({ type: String, enum: UserRole })
  role!: UserRole;

  @Prop({ type: OrgKyc })
  orgKyc?: OrgKyc;

  @Prop({ type: BankAccount })
  primaryBankAccount?: BankAccount;

  @Prop({ type: [CatalogProduct], default: [] })
  catalog?: CatalogProduct[];

  @Prop({ type: [PriceFloor], default: [] })
  priceFloors?: PriceFloor[];

  @Prop({ type: [ComplianceDocument], default: [] })
  complianceDocuments?: ComplianceDocument[];

  @Prop({ type: LogisticsPreference })
  logisticsPreference?: LogisticsPreference;

  @Prop({ default: [] })
  completedSteps!: string[];

  @Prop({ default: 'DRAFT' })
  kycStatus!: string; // DRAFT, SUBMITTED, APPROVED, REJECTED

  // NEW: Lock editing when submitted or approved
  @Prop({ default: false })
  isOnboardingLocked!: boolean;

  // NEW: Rejection reason (if rejected)
  @Prop()
  rejectionReason?: string;

  @Prop({ type: Date, default: null })
  kycApprovedAt?: Date;

  @Prop({ default: null })
  kycApprovedBy?: string;

  @Prop({ default: 'ACTIVE' })
  status!: string;

  @Prop({ default: false })
  isVerified!: boolean;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
