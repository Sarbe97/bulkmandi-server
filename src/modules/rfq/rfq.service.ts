import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { Rfq, RfqDocument } from './schemas/rfq.schema';
import { RfqStatus } from 'src/common/enums';
import { AuditAction, AuditModule, AuditEntityType, LogisticsPreference } from 'src/common/constants/app.constants';
import { UsersService } from '../users/services/users.service';

@Injectable()
export class RfqService {
  constructor(
    @InjectModel(Rfq.name)
    private rfqModel: Model<RfqDocument>,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(userId: string, orgId: string, dto: CreateRfqDto) {
    this.logger.log(`Creating new RFQ for org: ${orgId} by user: ${userId}`);
    const rfqId = `RFQ-${Date.now()}`;
    const rfq = new this.rfqModel({
      rfqId,
      buyerId: orgId,
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
      logisticsPreference: dto.logisticsPreference || LogisticsPreference.PLATFORM_3PL,
      notes: dto.notes,
      status: dto.status || RfqStatus.OPEN,
      createdBy: new Types.ObjectId(userId),
    });
    const saved = await rfq.save();
    
    // FETCH VERIFIED SELLERS FOR BROADCASTING
    const verifiedSellers = saved.status === RfqStatus.OPEN 
      ? await this.usersService.findVerifiedSellers() 
      : [];

    this.auditService.log({
      action: AuditAction.RFQ_CREATED,
      module: AuditModule.RFQ,
      entityType: AuditEntityType.RFQ,
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: userId,
      afterState: { rfqId: saved.rfqId, status: saved.status, quantityMT: saved.quantityMT, category: saved.product.category },
      targetUserIds: verifiedSellers.map(s => s._id as any),
      description: `RFQ ${saved.rfqId} created by org ${orgId}${saved.status === RfqStatus.OPEN ? ' and published to sellers' : ''}`,
    });

    return saved;
  }

  async publish(id: string, userId: string, orgId: string) {
    this.logger.log(`Publishing RFQ: ${id} by user: ${userId}`);
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== orgId.toString()) throw new BadRequestException('Unauthorized');

    const prevStatus = rfq.status;
    rfq.status = RfqStatus.OPEN;
    rfq.publishedAt = new Date();
    const saved = await rfq.save();

    // FETCH VERIFIED SELLERS FOR BROADCASTING
    const verifiedSellers = await this.usersService.findVerifiedSellers();

    this.auditService.log({
      action: AuditAction.RFQ_PUBLISHED,
      module: AuditModule.RFQ,
      entityType: AuditEntityType.RFQ,
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: RfqStatus.OPEN, publishedAt: saved.publishedAt, category: saved.product.category },
      changedFields: ['status', 'publishedAt'],
      description: `RFQ ${saved.rfqId} published to verified sellers`,
      targetUserIds: verifiedSellers.map(s => s._id as any),
    });

    return saved;
  }

  async findByBuyerId(buyerId: string, filters: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.rfqModel.find({ buyerId, ...validFilters }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findOpenRFQs(filters: Record<string, any> = {}, page = 1, limit = 20) {
    return this.rfqModel.find({ status: RfqStatus.OPEN, ...filters }).skip((page - 1) * limit).limit(limit).sort({ publishedAt: -1 });
  }

  async findAll(filters: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.rfqModel.find(validFilters).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findByIdOrFail(id: string) {
    let rfq;
    this.logger.debug(`Looking up RFQ with ID: ${id}`);

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

  async close(id: string, userId: string, orgId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== orgId.toString()) throw new BadRequestException('Unauthorized');

    const prevStatus = rfq.status;
    rfq.status = RfqStatus.CLOSED;
    const saved = await rfq.save();

    this.auditService.log({
      action: AuditAction.RFQ_CLOSED,
      module: AuditModule.RFQ,
      entityType: AuditEntityType.RFQ,
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: RfqStatus.CLOSED },
      changedFields: ['status'],
      description: `RFQ ${saved.rfqId} closed`,
      targetOrgIds: [orgId as any],
    });

    return saved;
  }

  async update(id: string, userId: string, orgId: string, dto: CreateRfqDto) {
    const rfq = await this.findByIdOrFail(id);
    if (rfq.buyerId.toString() !== orgId.toString()) throw new BadRequestException('Unauthorized');

    const canEdit = rfq.status === RfqStatus.DRAFT || (rfq.status === RfqStatus.OPEN && (rfq.quotesCount || 0) === 0);
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
    rfq.logisticsPreference = dto.logisticsPreference;
    rfq.notes = dto.notes;
    if (dto.status) rfq.status = dto.status;
    if (rfq.status === RfqStatus.OPEN && !rfq.publishedAt) rfq.publishedAt = new Date();

    const saved = await rfq.save();

    this.auditService.log({
      action: AuditAction.RFQ_UPDATED,
      module: AuditModule.RFQ,
      entityType: AuditEntityType.RFQ,
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: saved.status, quantityMT: saved.quantityMT },
      changedFields: ['product', 'quantityMT', 'targetPin', 'deliveryBy', 'incoterm', 'notes', 'status'],
      description: `RFQ ${saved.rfqId} updated`,
      targetOrgIds: [orgId as any],
    });

    return saved;
  }

  async deleteRfq(id: string, userId: string, orgId: string) {
    const rfq = await this.findByIdOrFail(id);
    if (rfq.buyerId.toString() !== orgId.toString()) throw new BadRequestException('Unauthorized');

    if ((rfq.quotesCount || 0) > 0) {
      throw new BadRequestException('Cannot delete RFQ after quotes have been submitted');
    }

    const result = await this.rfqModel.deleteOne({ _id: rfq._id });

    this.auditService.log({
      action: AuditAction.RFQ_DELETED,
      module: AuditModule.RFQ,
      entityType: AuditEntityType.RFQ,
      entityId: rfq._id as any,
      entityIdStr: rfq.rfqId,
      actorId: userId,
      beforeState: { status: rfq.status, rfqId: rfq.rfqId },
      description: `RFQ ${rfq.rfqId} deleted by user ${userId} of org ${orgId}`,
      severity: 'WARNING',
      targetOrgIds: [orgId as any],
    });

    return result;
  }
}
