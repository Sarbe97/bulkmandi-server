import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateBatchDto } from "./dto/create-batch.dto";
import {
  SettlementBatch,
  SettlementBatchDocument,
} from "./schemas/settlement-batch.schema";

@Injectable()
export class SettlementsService {
  constructor(
    @InjectModel(SettlementBatch.name)
    private settlementBatchModel: Model<SettlementBatchDocument>
  ) {}

  async createBatch(dto: CreateBatchDto, adminId: string) {
    const batch = new this.settlementBatchModel({
      ...dto,
      batchId: `ST-${Date.now()}`,
      createdBy: adminId,
      createdAt: new Date(),
      status: "DRAFT",
      orderCount: dto.orderIds.length,
      statusTimeline: [{ status: "DRAFT", timestamp: new Date() }],
    });
    return batch.save();
  }

  async findAllBatches(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ) {
    return this.settlementBatchModel
      .find(filters)
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findBatchByIdOrFail(id: string) {
    const batch = await this.settlementBatchModel.findById(id);
    if (!batch) throw new NotFoundException("Settlement batch not found");
    return batch;
  }

  async runPayouts(batchId: string, adminId: string) {
    // Placeholder: would create payouts linked to all lineItems
    return { batchId, executedBy: adminId, payoutCount: 0 };
  }

  async findPayoutsByPayeeId(
    payeeId: string,
    filters: Record<string, string>,
    page: number,
    limit: number
  ) {
    // Placeholder: refer to payoutModel if implemented
    return [];
  }

  async findPayoutByIdOrFail(id: string) {
    // Placeholder: refer to payoutModel if implemented
    return {};
  }

  async confirmPayout(
    id: string,
    body: { bankReference: string; utrs: string[] }
  ) {
    // Placeholder for bank confirmation
    return { payoutId: id, ...body, status: "CONFIRMED" };
  }

  async getSummary(startDate: string, endDate: string) {
    // Placeholder aggregation
    return { startDate, endDate, total: 0 };
  }

  async getHistoryByPayeeId(payeeId: string) {
    // Placeholder: refer to payoutModel if implemented
    return [];
  }
}
