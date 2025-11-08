import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "src/modules/organizations/schemas/organization.schema";
import { KycCase, KycCaseDocument } from "../schemas/kyc.schema";

@Injectable()
export class KycCaseService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private readonly logger: CustomLoggerService,
  ) {}

  // async createKycCaseOnSubmission(orgId: string) {
  //   this.logger.log(`createKycCaseOnSubmission called for orgId: ${orgId}`, "KYC");

  //   const org = await this.orgModel.findById(orgId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for createKycCaseOnSubmission, orgId: ${orgId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }

  //   const count = await this.kycCaseModel.countDocuments({ organizationId: orgId });
  //   this.logger.log(`Existing submissions count for orgId ${orgId}: ${count}`, "KYC");

  //   const submissionAttempt = count + 1;
  //   const submissionNumber = `KYC-${orgId}-${String(submissionAttempt).padStart(3, "0")}`;
  //   this.logger.log(`Generated submissionNumber: ${submissionNumber}`, "KYC");

  //   const kycCase = new this.kycCaseModel({
  //     organizationId: new Types.ObjectId(orgId),
  //     submissionNumber,
  //     status: KYCStatus.SUBMITTED,
  //     submittedData: {
  //       orgKyc: org.orgKyc,
  //       primaryBankAccount: org.primaryBankAccount,
  //       complianceDocuments: org.complianceDocuments,
  //       catalog: org.catalog,
  //       priceFloors: org.priceFloors,
  //       logisticsPreference: org.logisticsPreference,
  //     },
  //     submissionAttempt,
  //     activityLog: [
  //       {
  //         action: KYCStatus.SUBMITTED,
  //         timestamp: new Date(),
  //         performedBy: orgId,
  //         remarks: "Initial submission",
  //       },
  //     ],
  //   });

  //   this.logger.log(`Saving new KYC case for orgId: ${orgId}`, "KYC");
  //   return kycCase.save();
  // }

  // async approveKycCase(kycCaseId: string, adminId: string, remarks?: string) {
  //   this.logger.log(`approveKycCase called for kycCaseId: ${kycCaseId} by admin: ${adminId}`, "KYC");

  //   const kycCase = await this.kycCaseModel.findById(kycCaseId);
  //   if (!kycCase) {
  //     this.logger.warn(`KycCase not found for approval, kycCaseId: ${kycCaseId}`, "KYC");
  //     throw new NotFoundException("KycCase not found");
  //   }

  //   const org = await this.orgModel.findById(kycCase.organizationId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for KYC approval, kycCaseId: ${kycCaseId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }

  //   kycCase.status = KYCStatus.APPROVED;
  //   kycCase.reviewedBy = adminId;
  //   kycCase.reviewedAt = new Date();
  //   kycCase.activityLog.push({
  //     action: "APPROVED",
  //     timestamp: new Date(),
  //     performedBy: adminId,
  //     remarks: remarks || "Approved by admin",
  //   });
  //   await kycCase.save();
  //   this.logger.log(`KYC case approved and saved, kycCaseId: ${kycCaseId}`, "KYC");

  //   org.kycStatus = "APPROVED";
  //   org.kycApprovedAt = new Date();
  //   org.kycApprovedBy = adminId;
  //   org.isVerified = true;
  //   org.isOnboardingLocked = true;
  //   await org.save();
  //   this.logger.log(`Organization updated for approval, orgId: ${org._id}`, "KYC");

  //   return { kycCase, organization: org };
  // }

  // async rejectKycCase(kycCaseId: string, adminId: string, rejectionReason: string) {
  //   this.logger.log(`rejectKycCase called for kycCaseId: ${kycCaseId} by admin: ${adminId}`, "KYC");

  //   const kycCase = await this.kycCaseModel.findById(kycCaseId);
  //   if (!kycCase) {
  //     this.logger.warn(`KycCase not found for rejection, kycCaseId: ${kycCaseId}`, "KYC");
  //     throw new NotFoundException("KycCase not found");
  //   }

  //   const org = await this.orgModel.findById(kycCase.organizationId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for KYC rejection, kycCaseId: ${kycCaseId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }

  //   kycCase.status = KYCStatus.REJECTED;
  //   kycCase.rejectionReason = rejectionReason;
  //   kycCase.reviewedBy = adminId;
  //   kycCase.reviewedAt = new Date();
  //   kycCase.activityLog.push({
  //     action: "REJECTED",
  //     timestamp: new Date(),
  //     performedBy: adminId,
  //     remarks: rejectionReason,
  //   });
  //   await kycCase.save();
  //   this.logger.log(`KYC case rejected and saved, kycCaseId: ${kycCaseId}`, "KYC");

  //   org.kycStatus = "REJECTED";
  //   org.isOnboardingLocked = false;
  //   org.rejectionReason = rejectionReason;
  //   await org.save();
  //   this.logger.log(`Organization updated after rejection, orgId: ${org._id}`, "KYC");

  //   return { kycCase, organization: org };
  // }

  // async getKycCaseHistory(orgId: string) {
  //   this.logger.log(`getKycCaseHistory called for orgId: ${orgId}`, "KYC");
  //   const cases = await this.kycCaseModel.find({ organizationId: orgId }).sort({ submissionAttempt: -1 });
  //   this.logger.log(`Fetched ${cases.length} KYC cases for organization ${orgId}`, "KYC");
  //   return cases;
  // }

  // async getLatestKycCase(orgId: string) {
  //   this.logger.log(`getLatestKycCase called for orgId: ${orgId}`, "KYC");
  //   const kycCase = await this.kycCaseModel.findOne({ organizationId: orgId }).sort({ submissionAttempt: -1 });
  //   this.logger.log(`Latest KYC case found: ${kycCase?._id}`, "KYC");
  //   return kycCase;
  // }

  // NEW: Methods that were missing from your KycService
  // async submitKYC(orgId: string, dto: any) {
  //   this.logger.log(`submitKYC called for orgId: ${orgId}`, "KYC");
  //   const org = await this.orgModel.findById(orgId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for submitKYC, orgId: ${orgId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }
  //   // Placeholder for further processing
  //   this.logger.log(`submitKYC returning organization object for orgId: ${orgId}`, "KYC");
  //   return org;
  // }

  // async getKYCByOrgId(orgId: string) {
  //   this.logger.log(`getKYCByOrgId called for orgId: ${orgId}`, "KYC");
  //   const org = await this.orgModel.findById(orgId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for getKYCByOrgId, orgId: ${orgId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }
  //   this.logger.log(`Organization found for getKYCByOrgId, orgId: ${orgId}`, "KYC");
  //   return org;
  // }

  // async updateStep(orgId: string, stepName: string, stepData: any) {
  //   this.logger.log(`updateStep called for orgId: ${orgId}, stepName: ${stepName}`, "KYC");
  //   const org = await this.orgModel.findById(orgId);
  //   if (!org) {
  //     this.logger.warn(`Organization not found for updateStep, orgId: ${orgId}`, "KYC");
  //     throw new NotFoundException("Organization not found");
  //   }
  //   org[stepName] = stepData;
  //   this.logger.log(`Updated step ${stepName} for orgId: ${orgId}`, "KYC");
  //   return org.save();
  // }

  // async getKYCByCaseId(caseId: string) {
  //   this.logger.log(`getKYCByCaseId called for caseId: ${caseId}`, "KYC");
  //   const kycCase = await this.kycCaseModel.findById(caseId).populate("organizationId");
  //   if (!kycCase) {
  //     this.logger.warn(`KycCase not found for getKYCByCaseId, caseId: ${caseId}`, "KYC");
  //     throw new NotFoundException("KycCase not found");
  //   }
  //   this.logger.log(`KycCase found for getKYCByCaseId, caseId: ${caseId}`, "KYC");
  //   return kycCase;
  // }
}
