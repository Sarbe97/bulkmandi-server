import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { KYCStatus } from "@modules/kyc/kyc-status.constants";
import { KycAdminService } from "@modules/kyc/services/kyc-admin.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { User, UserDocument } from "@modules/users/schemas/user.schema";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { UserBankDto, UserOrgKycDto } from "../dto";
import { FleetAndComplianceFormDataDto } from "../dto/fleet-compliance.dto";

// Step Services
import { OrgKycStepService } from "./steps/org-kyc-step.service";
import { BankDetailsStepService } from "./steps/bank-details-step.service";
import { ComplianceStepService } from "./steps/compliance-step.service";
import { IntegrationsService } from "@modules/integrations/integrations.service";


// Define required steps per role
const REQUIRED_STEPS_BY_ROLE = {
  [UserRole.BUYER]: ["org-kyc", "bank-details", "compliance-docs", "buyer-preferences"],
  [UserRole.SELLER]: ["org-kyc", "bank-details", "compliance-docs", "catalog"],
  [UserRole.LOGISTIC]: [
    'org-kyc',
    'bank-details',
    'fleet-compliance',
    'compliance-docs',
  ],
};

@Injectable()
export class UserOnboardingService {
  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly kycAdminService: KycAdminService,
    private readonly logger: CustomLoggerService,
    private readonly idGenerator: IdGeneratorService,

    // Injected Step Services
    private readonly orgKycService: OrgKycStepService,
    private readonly bankDetailsService: BankDetailsStepService,
    private readonly complianceService: ComplianceStepService,
    private readonly integrationsService: IntegrationsService,
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

  // ===== DELEGATED STEPS =====

  /**
   * Step 1: Update Organization KYC
   */
  async updateOrgKyc(organizationId: string | null, dto: UserOrgKycDto, userRole: UserRole, userId: string): Promise<any> {
    const org = await this.orgKycService.updateOrgKyc(organizationId, dto, userRole, userId);
    return this.formatResponse(org);
  }

  /**
   * Step 2: Update Bank Details
   */
  async updateBankDetails(organizationId: string, dto: UserBankDto, userRole: UserRole): Promise<any> {
    const org = await this.bankDetailsService.updateBankDetails(organizationId, dto, userRole);
    return this.formatResponse(org);
  }

  /**
   * Verified Bank Details (Penny Drop)
   */
  async verifyBankDetails(organizationId: string, accountNumber: string, ifsc: string): Promise<any> {
    try {
      this.logger.log(`Verifying bank details for org ${organizationId}`, "UserOnboardingService.verifyBankDetails");

      const result = await this.integrationsService.verifyPennyDrop(accountNumber, ifsc);

      // Note: We don't save to DB here. Client must call updateBankDetails with the result status.
      return {
        verified: true,
        accountName: result.registered_name || result.account_name || "Verified User", // Razorpay response fields vary
        message: "Bank account verified successfully"
      };
    } catch (error) {
      this.logger.error(`Penny drop verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 3: Update Compliance Docs
   */
  async updateComplianceDocs(organizationId: string, dto: any, userRole: UserRole): Promise<any> {
    const org = await this.complianceService.updateComplianceDocs(organizationId, dto, userRole);
    return this.formatResponse(org);
  }

  async updateFleetAndCompliance(
    organizationId: string,
    dto: FleetAndComplianceFormDataDto,
    userRole: UserRole,
  ): Promise<any> {
    const org = await this.complianceService.updateFleetAndCompliance(organizationId, dto, userRole);
    return this.formatResponse(org);
  }

  // ===== ROLE-SPECIFIC STEPS (Still in main service for now) =====

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
  async getProgress(organizationId: string | null, userRole: UserRole): Promise<any> {
    try {
      if (!organizationId) {
        return {
          organizationId: null,
          role: userRole,
          completedSteps: [],
          currentProgress: 0,
          isOnboardingLocked: false,
          kycStatus: "DRAFT",
          rejectionReason: null,
          allSteps: this.getRequiredStepsForRole(userRole),
          nextStep: "org-kyc",
          createdAt: null,
          updatedAt: null,
        };
      }

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
  async getOnboardingData(organizationId: string | null): Promise<any> {
    try {
      if (!organizationId) {
        return {
          organizationId: null,
          orgCode: null,
          legalName: "",
          role: null,
          kycStatus: "DRAFT",
          isOnboardingLocked: false,
          completedSteps: [],
          orgKyc: null,
          primaryBankAccount: null,
          compliance: null,
          buyerPreferences: null,
          catalog: null,
          fleetAndCompliance: null,
          logisticsPreference: null,
        };
      }

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

      // ✅ Check for duplicate organization name (excluding self)
      const duplicate = await this.orgModel.findOne({
        legalName: new RegExp(`^${org.legalName}$`, 'i'),
        role: org.role,
        kycStatus: { $in: ['SUBMITTED', 'APPROVED', 'REJECTED'] },
        _id: { $ne: org._id },
      });

      if (duplicate) {
        throw new ConflictException(
          `Organization "${org.legalName}" already exists and has been submitted. ` +
          `Please search for it and request an invite code from admin.`,
        );
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
          id: kycCase.caseCode,
          caseCode: kycCase.caseCode,
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
      organizationId: org.orgCode || org._id.toString(), // ✅ Return business-friendly ID (fallback to ObjectId)
      orgCode: org.orgCode, // ✅ Explicit business-friendly code
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
