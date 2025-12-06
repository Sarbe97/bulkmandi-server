import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { KYCStatus } from "@modules/kyc/kyc-status.constants";
import { KycAdminService } from "@modules/kyc/services/kyc-admin.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { UserBankDto, UserOrgKycDto } from "../dto";
import { FleetAndComplianceFormDataDto } from "../dto/fleet-compliance.dto";

// Define required steps per role
const REQUIRED_STEPS_BY_ROLE = {
  [UserRole.BUYER]: ["org-kyc", "bank-details", "compliance-docs", "buyer-preferences"],
  [UserRole.SELLER]: ["org-kyc", "bank-details", "compliance-docs", "catalog"],
  [UserRole.LOGISTIC]: [
    'org-kyc',
    'bank-details',
    'fleet-compliance',          // New step
    'compliance-docs',
  ],
};

@Injectable()
export class UserOnboardingService {
  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    private readonly kycAdminService: KycAdminService,
    private readonly logger: CustomLoggerService,
  ) { }

  /**
   * Helper: Check if user can edit (onboarding not locked)
   */
  private checkEditPermission(org: OrganizationDocument): void {
    if (org.isOnboardingLocked) {
      throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`);
    }
  }

  /**
   * Helper: Get required steps for a role
   */
  private getRequiredStepsForRole(role: UserRole): string[] {
    return REQUIRED_STEPS_BY_ROLE[role] || REQUIRED_STEPS_BY_ROLE[UserRole.BUYER];
  }

  // ===== COMMON STEPS =====

  /**
   * Step 1: Update Organization KYC
   * Same logic for all roles, but org-kyc is stored in same field
   */
  async updateOrgKyc(organizationId: string, dto: UserOrgKycDto, userRole: UserRole): Promise<any> {
    try {
      this.logger.log(`updateOrgKyc: org=${organizationId}, role=${userRole}`);

      console.log("DTO received in updateOrgKyc:", dto);
      let org = await this.orgModel.findById(organizationId);
      if (!org) {
        org = new this.orgModel({
          _id: organizationId,
          role: userRole,
          completedSteps: [],
          isOnboardingLocked: false,
        });
      }

      this.checkEditPermission(org);

      org.legalName = dto.legalName;
      org.orgKyc = {
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        gstin: dto.gstin,
        pan: dto.pan,
        cin: dto.cin,
        registeredAddress: dto.registeredAddress,
        businessType: dto.businessType,
        incorporationDate: dto.incorporationDate,
        primaryContact: dto.primaryContact,
        plantLocations: dto.plantLocations,
      };

      if (!org.completedSteps.includes("org-kyc")) {
        org.completedSteps.push("org-kyc");
      }

      await org.save();
      this.logger.log(`KYC data updated for org ${organizationId}`);

      return this.formatResponse(org);
    } catch (error) {
      this.logger.error(`Error updating org KYC for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 2: Update Bank Details
   * Same for all roles
   */
  async updateBankDetails(organizationId: string, dto: UserBankDto, userRole: UserRole): Promise<any> {
    try {
      this.logger.log(`updateBankDetails: org=${organizationId}, role=${userRole}`);

      const org = await this.orgModel.findById(organizationId);
      if (!org) throw new NotFoundException("Organization not found");

      this.checkEditPermission(org);

      if (!org.primaryBankAccount) {
        org.primaryBankAccount = { documents: [] };
      }

      org.primaryBankAccount = {
        accountNumber: dto.accountNumber,
        accountHolderName: dto.accountHolderName,
        ifsc: dto.ifsc,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountType: dto.accountType,

        payoutMethod: dto.payoutMethod,
        upiDetails: dto.upiDetails,

        pennyDropStatus: dto.pennyDropStatus || "PENDING",
        pennyDropScore: dto.pennyDropScore || 0,

        documents: (dto.documents || []).map((doc) => ({
          docType: doc.docType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: new Date(doc.uploadedAt || new Date()),
          status: doc.status,
        })),
      };

      if (!org.completedSteps.includes("bank-details")) {
        org.completedSteps.push("bank-details");
      }

      await org.save();
      this.logger.log(`Bank details updated for org ${organizationId}`);

      return this.formatResponse(org);
    } catch (error) {
      this.logger.error(`Error updating bank details for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 3: Update Compliance Docs
   * Same for all roles
   */
  async updateComplianceDocs(organizationId: string, dto: any, userRole: UserRole): Promise<any> {
    try {
      this.logger.log(`updateComplianceDocs: org=${organizationId}, role=${userRole}`);

      const org = await this.orgModel.findById(organizationId);
      if (!org) throw new NotFoundException("Organization not found");

      this.checkEditPermission(org);

      if (!dto.warrantyAssurance || !dto.termsAccepted || !dto.amlCompliance) {
        throw new BadRequestException("All declarations must be accepted");
      }

      if (!dto.documents || dto.documents.length === 0) {
        throw new BadRequestException("At least one compliance document is required");
      }

      org.compliance = {
        documents: dto.documents.map((doc) => ({
          docType: doc.docType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: new Date(doc.uploadedAt || new Date()),
          status: doc.status,
        })),
        declarations: {
          warrantyAssurance: dto.warrantyAssurance,
          termsAccepted: dto.termsAccepted,
          amlCompliance: dto.amlCompliance,
        },
      };

      if (!org.completedSteps.includes("compliance-docs")) {
        org.completedSteps.push("compliance-docs");
      }

      await org.save();
      this.logger.log(`Compliance docs updated for org ${organizationId}`);

      return this.formatResponse(org);
    } catch (error) {
      this.logger.error(`Error updating compliance docs for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  async updateFleetAndCompliance(
    organizationId: string,
    dto: FleetAndComplianceFormDataDto,
    userRole: UserRole,
  ): Promise<any> {
    if (userRole !== UserRole.LOGISTIC) {
      throw new ForbiddenException('Step "fleet-compliance" is only for logistic users');
    }

    const org = await this.orgModel.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    if (org.isOnboardingLocked) {
      throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}.`);
    }

    // Save/update fleet & compliance data
    org.fleetAndCompliance = {
      fleetTypes: dto.fleetTypes,
      insuranceExpiry: dto.insuranceExpiry,
      policyDocument: dto.policyDocument, // handle file upload as per your system
      ewayBillIntegration: dto.ewayBillIntegration,
      podMethod: dto.podMethod,
    };

    if (!org.completedSteps.includes('fleet-compliance')) {
      org.completedSteps.push('fleet-compliance');
    }

    await org.save();

    return this.formatResponse(org);
  }
  // ===== ROLE-SPECIFIC STEPS =====

  /**
   * Generic handler for role-specific steps
   * Validates that step is allowed for role, then updates
   */
  async updateRoleSpecificStep(organizationId: string, stepKey: string, dto: any, userRole: UserRole, allowedRole: UserRole): Promise<any> {
    try {
      // Validate role
      if (userRole !== allowedRole) {
        throw new ForbiddenException(`Step '${stepKey}' is only available for ${allowedRole} users`);
      }

      this.logger.log(`updateRoleSpecificStep: step=${stepKey}, org=${organizationId}, role=${userRole}`);

      const org = await this.orgModel.findById(organizationId);
      if (!org) throw new NotFoundException("Organization not found");

      this.checkEditPermission(org);

      // Handle buyer-specific preferences
      if (stepKey === "buyer-preferences") {
        org.buyerPreferences = {
          categories: dto.categories,
          typicalMonthlyVolumeMT: dto.typicalMonthlyVolumeMT,
          incoterms: dto.incoterms,
          deliveryPins: dto.deliveryPins,
          acceptanceWindow: dto.acceptanceWindow,
          qcRequirement: dto.qcRequirement,
          notifyEmail: dto.notifyEmail ?? true,
          notifySMS: dto.notifySMS ?? true,
          notifyWhatsApp: dto.notifyWhatsApp ?? false,
          notes: dto.notes,
        };
      }

      // Handle seller-specific catalog
      if (stepKey === "catalog") {
        org.catalog = dto;
      }

      // Handle LOGISTIC logistics (future)
      if (stepKey === "logistics-prefs") {
        org.catalog.logisticsPreference = dto;
      }

      if (!org.completedSteps.includes(stepKey)) {
        org.completedSteps.push(stepKey);
      }

      await org.save();
      this.logger.log(`Step '${stepKey}' completed for org ${organizationId}`);

      return this.formatResponse(org);
    } catch (error) {
      this.logger.error(`Error updating step '${stepKey}' for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  // ===== COMMON STATUS & SUBMISSION =====

  /**
   * Get onboarding progress
   */
  async getProgress(organizationId: string, userRole: UserRole): Promise<any> {
    try {
      const org = await this.orgModel.findById(organizationId);
      if (!org) throw new NotFoundException("Organization not found");

      const requiredSteps = this.getRequiredStepsForRole(userRole);
      const completed = org.completedSteps || [];
      const progress = requiredSteps.length > 0 ? Math.round((completed.length / requiredSteps.length) * 100) : 0;

      const nextStep = requiredSteps.find((s) => !completed.includes(s));

      return {
        organizationId: org._id.toString(),
        role: userRole,
        completedSteps: completed,
        currentProgress: progress,
        isOnboardingLocked: org.isOnboardingLocked,
        kycStatus: org.kycStatus,
        rejectionReason: org.rejectionReason,
        allSteps: requiredSteps,
        nextStep,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error getting progress for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get complete onboarding data
   */
  async getOnboardingData(organizationId: string): Promise<any> {
    try {
      const org = await this.orgModel.findById(organizationId);
      if (!org) throw new NotFoundException("Organization not found");

      return this.formatResponse(org);
    } catch (error) {
      this.logger.error(`Error getting onboarding data for org ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit onboarding for KYC
   */

  async submitOnboarding(organizationId: string, userRole: UserRole): Promise<any> {
    try {
      this.logger.log(`submitOnboarding: organizationId=${organizationId}, role=${userRole}`);

      // Find organization by userId
      const org = await this.orgModel.findById(organizationId);
      if (!org) {
        throw new NotFoundException("Organization not found for user");
      }

      // Block if already locked
      if (org.isOnboardingLocked) {
        throw new ForbiddenException(`Onboarding is already locked with status: ${org.kycStatus}`);
      }

      const requiredSteps = this.getRequiredStepsForRole(userRole);
      const completed = org.completedSteps || [];
      const missing = requiredSteps.filter((s) => !completed.includes(s));

      if (missing.length > 0) {
        throw new BadRequestException(`Missing steps: ${missing.join(", ")}`);
      }

      const latestKycCase = await this.kycAdminService.getLatestKycCase(org._id.toString());

      let kycCase;
      if (!latestKycCase || [KYCStatus.DRAFT, KYCStatus.REJECTED].includes(latestKycCase.status as KYCStatus)) {
        kycCase = await this.kycAdminService.createKycCaseOnSubmission(org._id.toString());
      } else if (latestKycCase.status === KYCStatus.INFO_REQUESTED) {
        kycCase = await this.kycAdminService.updateKycCase(latestKycCase.id);
      } else if (latestKycCase.status === KYCStatus.REVISION_REQUESTED) {
        kycCase = await this.kycAdminService.createKycCaseOnSubmission(org._id.toString());
      } else {
        throw new BadRequestException("Invalid KYC submission state");
      }

      org.kycStatus = KYCStatus.SUBMITTED;
      org.isOnboardingLocked = true;
      await org.save();

      this.logger.log(`Onboarding submitted for Organization ${organizationId}`);

      return {
        success: true,
        message: `${userRole} onboarding submitted for verification`,
        kycCase: {
          id: kycCase._id.toString(),
          submissionNumber: kycCase.submissionNumber,
          status: kycCase.status,
        },
      };
    } catch (error) {
      this.logger.error(`Error submitting onboarding for Organization ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  // ===== HELPERS =====

  /**
   * Format standardized response
   */
  private formatResponse(org: OrganizationDocument): any {
    return {
      organizationId: org._id.toString(),
      orgId: org.orgId,
      legalName: org.legalName,
      role: org.role,
      kycStatus: org.kycStatus,
      isOnboardingLocked: org.isOnboardingLocked,
      rejectionReason: org.rejectionReason || null,
      completedSteps: org.completedSteps,
      orgKyc: org.orgKyc || null,
      primaryBankAccount: org.primaryBankAccount || null,
      compliance: org.compliance || null,
      buyerPreferences: org.buyerPreferences || null,
      catalog: org.catalog || null,
      fleetAndCompliance: org.fleetAndCompliance || null,
      logisticsPreference: org.catalog?.logisticsPreference || null,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}
