import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBatchDto } from 'src/modules/settlements/dto/create-batch.dto';
import { SettlementsService } from 'src/modules/settlements/settlements.service';
import { SettlementBatch, SettlementBatchDocument } from 'src/modules/settlements/schemas/settlement-batch.schema';

@Injectable()
export class SettlementsAdminService {
  constructor(
    @InjectModel(SettlementBatch.name)
    private settlementBatchModel: Model<SettlementBatchDocument>,
    @Inject(forwardRef(() => SettlementsService))
    private readonly settlementsService: SettlementsService,
  ) {}

  async createBatch(dto: CreateBatchDto) {
    const batch = new this.settlementBatchModel({
      ...dto,
      createdAt: new Date(),
      status: 'DRAFT',
      orderCount: dto.orderIds.length,
      statusTimeline: [{ status: 'DRAFT', timestamp: new Date() }],
    });
    return batch.save();
  }

  async findBatches(filters: any) {
    return this.settlementBatchModel.find(filters).limit(100).sort({ createdAt: -1 });
  }

  async runPayouts(batchId: string) {
    // Implement payout logic here or delegate to payout service
    return { batchId, payoutsExecuted: true };
  }

  async processQueue(adminId: string) {
    return this.settlementsService.processAutomatedSettlementQueue(adminId);
  }

  async forceRelease(orderId: string, adminId: string) {
    return this.settlementsService.forceReleaseStage2(orderId, adminId);
  }

  async extendBuffer(orderId: string, hours: number, adminId: string) {
    return this.settlementsService.extendSettlementBuffer(orderId, hours, adminId);
  }
}
