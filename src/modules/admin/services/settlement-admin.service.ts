import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBatchDto } from 'src/modules/settlements/dto/create-batch.dto';
import { SettlementBatch, SettlementBatchDocument } from 'src/modules/settlements/schemas/settlement-batch.schema';

@Injectable()
export class SettlementsAdminService {
  constructor(
    @InjectModel(SettlementBatch.name)
    private settlementBatchModel: Model<SettlementBatchDocument>,
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
}
