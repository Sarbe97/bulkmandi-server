import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Dispute, DisputeDocument } from './schemas/dispute.schema';
import { OrganizationsService } from '../organizations/organizations.service';
import { IdGeneratorService } from 'src/common/services/id-generator.service';

@Injectable()
export class DisputesService {
  constructor(
    @InjectModel(Dispute.name) private disputeModel: Model<DisputeDocument>,
    private readonly orgService: OrganizationsService,
    private readonly idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) {}

  async raise(orgId: string, dto: RaiseDisputeDto) {
    this.logger.log(`Raising dispute for order: ${dto.orderId} by org: ${orgId}`);
    
    // FETCH CLAIMANT ORG CODE
    let orgCode: string | undefined;
    try {
      const org = await this.orgService.getOrganization(orgId);
      orgCode = org.orgCode;
    } catch {
      this.logger.warn(`Could not fetch org code for claimant ${orgId}`);
    }

    const disputeId = this.idGenerator.generateBusinessId('DSP', orgCode);
    const dispute = new this.disputeModel({
      ...dto,
      claimantId: orgId,
      disputeId,
      raisedAt: new Date(),
      status: 'NEW',
    });
    return dispute.save();
  }

  async findByPartyId(orgId: string, filters = {}, page = 1, limit = 20) {
    return this.disputeModel.find({ $or: [ { claimantId: orgId }, { respondentId: orgId } ], ...filters }).skip((page - 1) * limit).limit(limit);
  }

  async findByIdOrFail(id: string) {
    const dispute = await this.disputeModel.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async uploadEvidence(id: string, body: { evidenceType: string; fileUrl: string; description: string }, userId: string) {
    const dispute = await this.disputeModel.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    dispute.evidence.push({ ...body, evidenceId: this.idGenerator.generateBusinessId('EVI'), uploadedAt: new Date(), uploadedBy: userId });
    return dispute.save();
  }

  async resolve(id: string, dto: ResolveDisputeDto, adminId: string) {
    const dispute = await this.disputeModel.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    dispute.status = 'RESOLVED';
    dispute.resolution = { ...dto, decidedAt: new Date(), decidedBy: adminId };
    return dispute.save();
  }

  async assign(id: string, assignTo: string) {
    const dispute = await this.disputeModel.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    dispute.assignedTo = assignTo;
    dispute.assignedAt = new Date();
    return dispute.save();
  }

  async findByOrderId(orderId: string) {
    return this.disputeModel.find({ orderId });
  }

  async checkDisputeWindow(orderId: string) {
    // Sample logic: return true if within 48h of order delivered
    return { canRaise: true, windowClosesAt: new Date(Date.now() + 48 * 3600 * 1000) };
  }
}
