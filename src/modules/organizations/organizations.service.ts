import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KycCaseService } from '../kyc/services/kyc.service';
import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,
    private kycCaseService: KycCaseService,
  ) {}

  /**
   * Check if user can edit (only if DRAFT or REJECTED)
   */
  private checkEditPermission(org: OrganizationDocument) {
    if (org.isOnboardingLocked) {
      throw new ForbiddenException(
        `Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`,
      );
    }
  }

  async updateOrgKyc(orgId: string, orgKycDto: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    this.checkEditPermission(org);

    org.orgKyc = { ...org.orgKyc, ...orgKycDto };
    if (!org.completedSteps.includes('orgKyc')) {
      org.completedSteps.push('orgKyc');
    }

    return org.save();
  }

  async updateBankDetails(orgId: string, bankDetailsDto: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    this.checkEditPermission(org);

    // Convert uploadedAt strings to Date objects
    if (bankDetailsDto.documents) {
      bankDetailsDto.documents = bankDetailsDto.documents.map((doc) => ({
        ...doc,
        uploadedAt:
          typeof doc.uploadedAt === 'string'
            ? new Date(doc.uploadedAt)
            : doc.uploadedAt,
      }));
    }

    org.primaryBankAccount = {
      ...org.primaryBankAccount,
      ...bankDetailsDto,
    } as any;
    if (!org.completedSteps.includes('bankDetails')) {
      org.completedSteps.push('bankDetails');
    }

    return org.save();
  }

  async updateCatalog(orgId: string, dto: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    this.checkEditPermission(org);

    org.catalog = dto.catalog;
    org.priceFloors = dto.priceFloors;
    org.logisticsPreference = dto.logisticsPreference;

    if (!org.completedSteps.includes('catalog')) {
      org.completedSteps.push('catalog');
    }

    return org.save();
  }

  async updateComplianceDocuments(orgId: string, dto: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    this.checkEditPermission(org);

    // Convert uploadedAt strings to Date objects
    const transformedDocs = dto.complianceDocuments.map((doc) => ({
      ...doc,
      uploadedAt:
        typeof doc.uploadedAt === 'string'
          ? new Date(doc.uploadedAt)
          : doc.uploadedAt,
    }));

    org.complianceDocuments = transformedDocs as any;

    if (!org.completedSteps.includes('docs')) {
      org.completedSteps.push('docs');
    }

    return org.save();
  }

  /**
   * Submit onboarding - creates KycCase and locks editing
   */
  async submitOnboarding(orgId: string) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    // Validate all required steps completed
    const requiredSteps = ['orgKyc', 'bankDetails', 'docs', 'catalog'];
    const allCompleted = requiredSteps.every((step) =>
      org.completedSteps.includes(step),
    );

    if (!allCompleted) {
      throw new BadRequestException(
        'Please complete all mandatory onboarding steps',
      );
    }

    // Create KycCase snapshot
    const kycCase = await this.kycCaseService.createKycCaseOnSubmission(orgId);

    // Update organization
    org.kycStatus = 'SUBMITTED';
    org.isOnboardingLocked = true; // Lock editing
    await org.save();

    return {
      organization: org,
      kycCase,
      message:
        'Onboarding submitted for review. Your data is now locked and cannot be edited until admin action.',
    };
  }

  async getOnboardingStatus(orgId: string) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    const latestKycCase = await this.kycCaseService.getLatestKycCase(orgId);
    console.log('Latest KYC Case:', latestKycCase);
    return {
      organizationId: org._id.toString(),
      legalName: org.legalName,
      kycStatus: org.kycStatus,
      isOnboardingLocked: org.isOnboardingLocked,
      rejectionReason: org.rejectionReason || null, // FIXED: Use rejectionReason
      completedSteps: org.completedSteps,
      orgKyc: org.orgKyc,
      primaryBankAccount: org.primaryBankAccount,
      complianceDocuments: org.complianceDocuments,
      catalog: org.catalog,
      priceFloors: org.priceFloors,
      logisticsPreference: org.logisticsPreference,
      latestSubmission: latestKycCase
        ? {
            submissionNumber: latestKycCase.submissionNumber,
            status: latestKycCase.status,
            submissionAttempt: latestKycCase.submissionAttempt,
            rejectionReason: latestKycCase.rejectionReason || null,
            reviewedAt: latestKycCase.reviewedAt,
          }
        : null,
    };
  }

  async getOnboardingReviewSummary(orgId: string) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    return {
      organizationId: org._id.toString(),
      legalName: org.legalName,
      kycStatus: org.kycStatus,
      isOnboardingLocked: org.isOnboardingLocked,
      completedSteps: org.completedSteps,
      stepStatus: {
        account: org.legalName ? 'COMPLETED' : 'PENDING',
        orgKyc: org.completedSteps.includes('orgKyc') ? 'COMPLETED' : 'PENDING',
        bank: org.completedSteps.includes('bankDetails')
          ? 'COMPLETED'
          : 'PENDING',
        docs: org.completedSteps.includes('docs') ? 'COMPLETED' : 'PENDING',
        catalog: org.completedSteps.includes('catalog')
          ? 'COMPLETED'
          : 'PENDING',
      },
      orgKyc: org.orgKyc,
      primaryBankAccount: org.primaryBankAccount,
      complianceDocuments: org.complianceDocuments,
      catalog: org.catalog,
      priceFloors: org.priceFloors,
      logisticsPreference: org.logisticsPreference,
    };
  }
}
