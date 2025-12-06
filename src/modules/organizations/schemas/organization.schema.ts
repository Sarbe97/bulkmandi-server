import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { UserRole } from "src/common/enums";

export type OrganizationDocument = Organization & Document;

@Schema({ _id: false })
export class PlantLocation {
  @Prop() name?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() pincode?: string;
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
export class OrgKyc {
  @Prop() legalName?: string;
  @Prop() tradeName?: string;
  @Prop() gstin?: string;
  @Prop() pan?: string;
  @Prop() cin?: string;
  @Prop() registeredAddress?: string;
  @Prop() businessType?: string;
  @Prop() incorporationDate?: string;
  @Prop({ type: [String], default: [] }) serviceStates?: string[];
  @Prop({ type: [PlantLocation], default: [] }) plantLocations?: PlantLocation[];
  @Prop({ type: Contact }) primaryContact?: Contact;
}
///////////

@Schema({ _id: false })
export class DocumentUpload {
  @Prop() docType?: string;
  @Prop() fileName?: string;
  @Prop() fileUrl?: string;
  @Prop({ type: Date }) uploadedAt?: Date;
  @Prop() status?: string; //['UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED']
}

@Schema({ _id: false })
export class BankAccount {
  @Prop() accountNumber?: string;
  @Prop() accountHolderName?: string;
  @Prop() accountType?: string;
  @Prop() ifsc?: string;
  @Prop() bankName?: string;
  @Prop() branchName?: string;

  @Prop() isPennyDropVerified?: boolean;
  @Prop() pennyDropStatus?: string;
  @Prop() pennyDropScore?: number;
  @Prop() payoutMethod?: string;
  @Prop() upiDetails?: string;
  @Prop({ type: [DocumentUpload], default: [] }) documents?: DocumentUpload[];
  // @Prop({ type: Declarations, default: {} }) declarations?: Declarations;
}
///////////
@Schema({ _id: false })
export class CatalogProduct {
  @Prop() category: string;
  @Prop() isSelected: boolean;
  @Prop({ type: [String] }) grades: string[];
  @Prop() moqPerOrder: number;
  @Prop() stdLeadTime: number;
  @Prop({ type: [String], default: [] }) availability: string[];
}

@Schema({ _id: false })
export class PriceFloor {
  @Prop() category: string;
  @Prop() pricePerMT: number;
}

@Schema({ _id: false })
export class LogisticsPreference {
  @Prop({ default: false }) usePlatform3PL: boolean;
  @Prop({ default: false }) selfPickupAllowed: boolean;
}

@Schema({ _id: false })
export class Catalog {
  @Prop({ type: [CatalogProduct], default: [] }) catalogProducts: CatalogProduct[];
  @Prop({ type: [PlantLocation], default: [] }) plantLocations: PlantLocation[];
  @Prop({ type: [PriceFloor], default: [] }) priceFloors: PriceFloor[];
  @Prop({ type: LogisticsPreference }) logisticsPreference: LogisticsPreference;
}

//////////////////

@Schema({ _id: false })
export class Declarations {
  @Prop({ default: false }) warrantyAssurance: boolean;
  @Prop({ default: false }) termsAccepted: boolean;
  @Prop({ default: false }) amlCompliance: boolean;
}

@Schema({ _id: false })
export class Compliance {
  @Prop({ type: [DocumentUpload], default: [] }) documents?: DocumentUpload[];
  @Prop({ type: Declarations, default: {} }) declarations?: Declarations;
}

///////////////
@Schema()
export class BuyerPreferences {
  @Prop() categories: string[];
  @Prop() typicalMonthlyVolumeMT?: number;
  @Prop() incoterms: string[];
  @Prop() deliveryPins: string[];
  @Prop() acceptanceWindow: string;
  @Prop() qcRequirement: string;
  @Prop() notifyEmail?: boolean;
  @Prop() notifySMS?: boolean;
  @Prop() notifyWhatsApp?: boolean;
  @Prop() notes?: string;
}

/////

@Schema()
export class FleetTypeItem {
  @Prop() type: string;
  @Prop() label: string;
  @Prop() vehicleCount: number;
}

@Schema()
export class FleetAndCompliance {
  @Prop({ type: [FleetTypeItem], default: [] }) fleetTypes: FleetTypeItem[];
  @Prop() insuranceExpiry: string;
  @Prop() policyDocument: DocumentUpload; // your file schema
  @Prop() ewayBillIntegration: string; // api | manual
  @Prop() podMethod: string; // driver_app | pdf
}
///////////
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

  @Prop({ type: Compliance, default: {} })
  compliance?: Compliance;

  @Prop({ type: Catalog, default: {} })
  catalog?: Catalog;

  @Prop({ type: BuyerPreferences, default: {} })
  buyerPreferences?: BuyerPreferences;

  @Prop({ type: FleetAndCompliance, default: null })
  fleetAndCompliance?: FleetAndCompliance;

  @Prop({ type: Declarations })
  declarations?: Declarations;

  @Prop({ default: [] })
  completedSteps!: string[]; // ['orgKyc', 'bankDetails', 'docs', 'catalog']

  @Prop({ default: "DRAFT" })
  kycStatus!: string; // DRAFT, SUBMITTED, APPROVED, REJECTED

  @Prop({ default: false })
  isOnboardingLocked!: boolean;

  @Prop()
  rejectionReason?: string;

  @Prop({ type: Date, default: null })
  kycApprovedAt?: Date;

  @Prop({ default: null })
  kycApprovedBy?: string;

  @Prop()
  updateReason?: string; // ✅ Just store the reason

  @Prop({ type: Date })
  updateRequestedAt?: Date;

  @Prop({ default: "ACTIVE" })
  status!: string;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ type: Date, default: null })
  submittedAt?: Date;

  @Prop()
  submissionRemarks?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
