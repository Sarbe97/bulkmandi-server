import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { KycCaseService } from './kyc.service';
import { KycCase, KycCaseDocument } from './schemas/kyc.schema';
@Injectable()
export class KycAdminService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private kycCaseService: KycCaseService,
  ) {}

  async getPendingKycSubmissions() {
    return this.kycCaseModel
      .find({ status: 'SUBMITTED' })
      .populate('organizationId')
      .sort({ createdAt: -1 });
  }

  async getKycCaseById(kycCaseId: string) {
    const kycCase = await this.kycCaseModel
      .findById(kycCaseId)
      .populate('organizationId');
    if (!kycCase) {
      throw new NotFoundException('KYC Case not found');
    }
    return kycCase;
  }

  async approveKycSubmission(kycCaseId: string, adminId: string, remarks?: string) {
    return this.kycCaseService.approveKycCase(kycCaseId, adminId, remarks);
  }

  async rejectKycSubmission(kycCaseId: string, adminId: string, rejectionReason: string) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.kycCaseService.rejectKycCase(kycCaseId, adminId, rejectionReason);
  }

  async getKycCaseHistory(orgId: string) {
    return this.kycCaseService.getKycCaseHistory(orgId);
  }
}
