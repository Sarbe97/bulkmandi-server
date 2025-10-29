import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KycCase, KycCaseDocument } from 'src/modules/kyc/schemas/kyc.schema';
import { UpdateKycStatusDto } from '../dto/update-kyc-status.dto';

@Injectable()
export class KycAdminService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
  ) {}

  async listCases(filters: any) {
    return this.kycCaseModel.find(filters).sort({ submittedAt: -1 });
  }

  async updateStatus(caseId: string, dto: UpdateKycStatusDto) {
    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) throw new NotFoundException('KYC case not found');
    kycCase.status = dto.status;
    // Optionally add comments/notes
    await kycCase.save();
    return kycCase;
  }
}
