import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { Rfq, RfqDocument } from './schemas/rfq.schema';

@Injectable()
export class RfqService {
  constructor(
    @InjectModel(Rfq.name)
    private rfqModel: Model<RfqDocument>,
    private readonly auditService: AuditService,
  ) {}

  async create(buyerId: string, dto: CreateRfqDto) {
    const rfqId = `RFQ-${Date.now()}`;
    const rfq = new this.rfqModel({
      rfqId,
      buyerId,
      buyerOrgName: dto.buyerOrgName,
      product: {
        category: dto.category,
        grade: dto.grade,
        subCategory: dto.subCategory,
        size: dto.size,
        tolerance: dto.tolerance,
        millTcRequired: dto.millTcRequired || false,
      },
      quantityMT: dto.quantityMT,
      targetPin: dto.targetPin,
      deliveryBy: new Date(dto.deliveryBy),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      incoterm: dto.incoterm,
      notes: dto.notes,
      status: dto.status || 'OPEN',
    });
    const saved = await rfq.save();

    this.auditService.log({
      action: 'RFQ_CREATED',
      module: 'RFQ',
      entityType: 'RFQ',
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: buyerId,
      afterState: { rfqId: saved.rfqId, status: saved.status, quantityMT: saved.quantityMT },
      description: `RFQ ${saved.rfqId} created by org ${buyerId}`,
    });

    return saved;
  }

  async publish(id: string, buyerId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');

    const prevStatus = rfq.status;
    rfq.status = 'OPEN';
    rfq.publishedAt = new Date();
    const saved = await rfq.save();

    this.auditService.log({
      action: 'RFQ_PUBLISHED',
      module: 'RFQ',
      entityType: 'RFQ',
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: buyerId,
      beforeState: { status: prevStatus },
      afterState: { status: 'OPEN', publishedAt: saved.publishedAt },
      changedFields: ['status', 'publishedAt'],
      description: `RFQ ${saved.rfqId} published`,
    });

    return saved;
  }

  async findByBuyerId(buyerId: string, filters: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.rfqModel.find({ buyerId, ...validFilters }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findOpenRFQs(filters: Record<string, any> = {}, page = 1, limit = 20) {
    return this.rfqModel.find({ status: 'OPEN', ...filters }).skip((page - 1) * limit).limit(limit).sort({ publishedAt: -1 });
  }

  async findAll(filters: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.rfqModel.find(validFilters).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findByIdOrFail(id: string) {
    let rfq;
    console.log(`[RfqService] Looking up RFQ with ID: ${id}`);

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      rfq = await this.rfqModel.findById(id);
    }

    if (!rfq) {
      rfq = await this.rfqModel.findOne({ rfqId: id });
    }

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }
    return rfq;
  }

  async close(id: string, buyerId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');

    const prevStatus = rfq.status;
    rfq.status = 'CLOSED';
    const saved = await rfq.save();

    this.auditService.log({
      action: 'RFQ_CLOSED',
      module: 'RFQ',
      entityType: 'RFQ',
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: buyerId,
      beforeState: { status: prevStatus },
      afterState: { status: 'CLOSED' },
      changedFields: ['status'],
      description: `RFQ ${saved.rfqId} closed`,
    });

    return saved;
  }

  async update(id: string, buyerId: string, dto: CreateRfqDto) {
    const rfq = await this.findByIdOrFail(id);
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');

    const canEdit = rfq.status === 'DRAFT' || (rfq.status === 'OPEN' && (rfq.quotesCount || 0) === 0);
    if (!canEdit) {
      throw new BadRequestException('RFQ cannot be edited once quotes are submitted or it is closed');
    }

    const prevStatus = rfq.status;

    rfq.buyerOrgName = dto.buyerOrgName;
    rfq.product = {
      category: dto.category,
      grade: dto.grade,
      subCategory: dto.subCategory,
      size: dto.size,
      tolerance: dto.tolerance,
      millTcRequired: dto.millTcRequired || false,
    };
    rfq.quantityMT = dto.quantityMT;
    rfq.targetPin = dto.targetPin;
    rfq.deliveryBy = new Date(dto.deliveryBy);
    if (dto.expiresAt !== undefined) rfq.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    rfq.incoterm = dto.incoterm;
    rfq.notes = dto.notes;
    if (dto.status) rfq.status = dto.status;
    if (rfq.status === 'OPEN' && !rfq.publishedAt) rfq.publishedAt = new Date();

    const saved = await rfq.save();

    this.auditService.log({
      action: 'RFQ_UPDATED',
      module: 'RFQ',
      entityType: 'RFQ',
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: buyerId,
      beforeState: { status: prevStatus },
      afterState: { status: saved.status, quantityMT: saved.quantityMT },
      changedFields: ['product', 'quantityMT', 'targetPin', 'deliveryBy', 'incoterm', 'notes', 'status'],
      description: `RFQ ${saved.rfqId} updated`,
    });

    return saved;
  }

  async deleteRfq(id: string, buyerId: string) {
    const rfq = await this.findByIdOrFail(id);
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');

    if ((rfq.quotesCount || 0) > 0) {
      throw new BadRequestException('Cannot delete RFQ after quotes have been submitted');
    }

    const result = await this.rfqModel.deleteOne({ _id: rfq._id });

    this.auditService.log({
      action: 'RFQ_DELETED',
      module: 'RFQ',
      entityType: 'RFQ',
      entityId: rfq._id as any,
      entityIdStr: rfq.rfqId,
      actorId: buyerId,
      beforeState: { status: rfq.status, rfqId: rfq.rfqId },
      description: `RFQ ${rfq.rfqId} deleted by org ${buyerId}`,
      severity: 'WARNING',
    });

    return result;
  }
}
