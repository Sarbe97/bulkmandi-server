import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { KycCase, KycCaseDocument } from './schemas/kyc.schema';
 
@Injectable()
export class KycCaseService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) {}

  async createKycCaseOnSubmission(orgId: string) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    const latestCase = await this.kycCaseModel
      .findOne({ organizationId: orgId })
      .sort({ submissionAttempt: -1 });

    const submissionAttempt = (latestCase?.submissionAttempt || 0) + 1;
    const submissionNumber = `KYC-${orgId}-${String(submissionAttempt).padStart(3, '0')}`;

    const kycCase = new this.kycCaseModel({
      organizationId: new Types.ObjectId(orgId),
      submissionNumber,
      status: 'SUBMITTED',
      submittedData: {
        orgKyc: org.orgKyc,
        primaryBankAccount: org.primaryBankAccount,
        complianceDocuments: org.complianceDocuments,
        catalog: org.catalog,
        priceFloors: org.priceFloors,
        logisticsPreference: org.logisticsPreference,
      },
      submissionAttempt,
      activityLog: [
        {
          action: 'SUBMITTED',
          timestamp: new Date(),
          performedBy: orgId,
          remarks: 'Initial submission',
        },
      ],
    });

    return kycCase.save();
  }

  async approveKycCase(kycCaseId: string, adminId: string, remarks?: string) {
    const kycCase = await this.kycCaseModel.findById(kycCaseId);
    if (!kycCase) throw new NotFoundException('KycCase not found');

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    kycCase.status = 'APPROVED';
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: 'APPROVED',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: remarks || 'Approved by admin',
    });
    await kycCase.save();

    org.kycStatus = 'APPROVED';
    org.kycApprovedAt = new Date();
    org.kycApprovedBy = adminId;
    org.isVerified = true;
    org.isOnboardingLocked = true;
    await org.save();

    return { kycCase, organization: org };
  }

  async rejectKycCase(kycCaseId: string, adminId: string, rejectionReason: string) {
    const kycCase = await this.kycCaseModel.findById(kycCaseId);
    if (!kycCase) throw new NotFoundException('KycCase not found');

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    kycCase.status = 'REJECTED';
    kycCase.rejectionReason = rejectionReason;
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: 'REJECTED',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: rejectionReason,
    });
    await kycCase.save();

    org.kycStatus = 'REJECTED';
    org.isOnboardingLocked = false;
    org.rejectionReason = rejectionReason;
    await org.save();

    return { kycCase, organization: org };
  }

  async getKycCaseHistory(orgId: string) {
    return this.kycCaseModel.find({ organizationId: orgId }).sort({ submissionAttempt: -1 });
  }

  async getLatestKycCase(orgId: string) {
    return this.kycCaseModel.findOne({ organizationId: orgId }).sort({ submissionAttempt: -1 });
  }

  // NEW: Methods that were missing from your KycService
  async submitKYC(orgId: string, dto: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getKYCByOrgId(orgId: string) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateStep(orgId: string, stepName: string, stepData: any) {
    const org = await this.orgModel.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');
    org[stepName] = stepData;
    return org.save();
  }

  async getKYCByCaseId(caseId: string) {
    const kycCase = await this.kycCaseModel.findById(caseId).populate('organizationId');
    if (!kycCase) throw new NotFoundException('KycCase not found');
    return kycCase;
  }
}
