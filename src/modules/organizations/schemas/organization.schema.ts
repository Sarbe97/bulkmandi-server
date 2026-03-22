import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { UserRole } from "src/common/enums";

export type OrganizationDocument = Organization & Document;

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
///////////
///////////
@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, unique: true, index: true })
  orgCode!: string; // Format: ORG-{ROLE}-{SEQUENCE} e.g., ORG-SEL-000123

  @Prop({ unique: true, sparse: true }) // Satisfy legacy index
  orgId?: string;

  @Prop({ required: true })
  legalName!: string;

  @Prop({ type: String, enum: ['SELF', 'ADMIN_SINGLE', 'ADMIN_BULK'], default: 'SELF' })
  creationSource!: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role!: UserRole;

  @Prop({ type: OrgKyc })
  orgKyc?: OrgKyc;

  @Prop({ type: BankAccount })
  primaryBankAccount?: BankAccount;

  @Prop({ type: Compliance, default: {} })
  compliance?: Compliance;

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

  @Prop({ type: [String], default: [] })
  lastRequestedFields?: string[]; // Fields that need update

  @Prop()
  lastAdminRemarks?: string; // Admin's message for info request

  createdAt?: Date;
  updatedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
