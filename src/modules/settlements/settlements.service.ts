import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CreateBatchDto } from "./dto/create-batch.dto";
import { Payout, PayoutDocument } from "./schemas/payout.schema";
import {
  SettlementBatch,
  SettlementBatchDocument,
} from "./schemas/settlement-batch.schema";
import { OrdersService } from "../orders/orders.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class SettlementsService {
  constructor(
    @InjectModel(SettlementBatch.name)
    private settlementBatchModel: Model<SettlementBatchDocument>,
    @InjectModel(Payout.name)
    private payoutModel: Model<PayoutDocument>,
    private readonly ordersService: OrdersService,
    private readonly orgService: OrganizationsService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) { }

  async createBatch(dto: CreateBatchDto, adminId: string) {
    const orders = await Promise.all(
      dto.orderIds.map(id => this.ordersService.findByIdOrFail(id))
    );

    // Grouping by party (Seller/3PL)
    const partyMap = new Map<string, any>();

    for (const order of orders) {
      // 1. Seller Payout logic
      const sellerId = order.sellerId.toString();
      if (!partyMap.has(sellerId)) {
        partyMap.set(sellerId, {
          partyId: order.sellerId,
          partyName: order.sellerOrgName,
          partyType: 'SELLER',
          orders: [],
          grossAmount: 0,
          platformFee: 0,
          disputeAdjustments: 0,
        });
      }
      const sellerEntry = partyMap.get(sellerId);
      sellerEntry.orders.push(order.orderId);
      sellerEntry.grossAmount += order.pricing.baseAmount + order.pricing.freightTotal;
      // Note: Tax is usually pass-through or handled at invoice. Here we track taxable gross.
      sellerEntry.platformFee += (order.pricing.baseAmount * 0.02); // Placeholder 2% fee

      // 2. 3PL Payout logic (Simplified: if freight exists, it might go to a carrier)
      // For this implementation, we assume Seller handles freight unless 3PL module is active.
    }

    const lineItems = Array.from(partyMap.values()).map(item => ({
      ...item,
      lineItemId: `LI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      netPayable: item.grossAmount - item.platformFee - item.disputeAdjustments,
      status: 'READY'
    }));

    const totals = {
      grossAmount: lineItems.reduce((sum, li) => sum + li.grossAmount, 0),
      platformFees: lineItems.reduce((sum, li) => sum + li.platformFee, 0),
      disputeAdjustments: lineItems.reduce((sum, li) => sum + li.disputeAdjustments, 0),
      netPayable: lineItems.reduce((sum, li) => sum + li.netPayable, 0),
      lineItemCount: lineItems.length
    };

    const batch = new this.settlementBatchModel({
      batchId: `ST-${Date.now()}`,
      batchName: `Batch-${new Date().toISOString().split('T')[0]}`,
      orderIds: dto.orderIds,
      orderCount: dto.orderIds.length,
      lineItems,
      totals,
      status: 'READY',
      createdBy: adminId,
      statusTimeline: [{ status: "READY", timestamp: new Date() }],
      settlementWindow: {
        windowType: 'MANUAL',
        windowDate: new Date().toISOString().split('T')[0],
        startDate: new Date(),
        endDate: new Date()
      }
    });

    const saved = await batch.save();

    this.auditService.log({
      action: 'SETTLEMENT_CREATED',
      module: 'SETTLEMENT',
      entityType: 'SETTLEMENT_BATCH',
      entityId: saved._id as any,
      entityIdStr: saved.batchId,
      actorId: adminId,
      afterState: { batchId: saved.batchId, orderCount: dto.orderIds.length, netPayable: saved.totals?.netPayable },
      description: `Settlement batch ${saved.batchId} created by admin with ${dto.orderIds.length} orders`,
    });

    return saved;
  }

  async runPayouts(batchId: string, adminId: string) {
    const batch = await this.findBatchByIdOrFail(batchId);
    if (batch.status !== 'READY') throw new BadRequestException('Batch is not in READY status');

    const isTestMode = this.configService.get<string>('TEST_MODE') === 'true';

    batch.status = 'PROCESSING';
    batch.statusTimeline.push({ status: 'PROCESSING', timestamp: new Date() });
    await batch.save();

    const payouts = [];

    for (const li of batch.lineItems) {
      const org = await this.orgService.getOrganization(li.partyId.toString());

      const payoutData: any = {
        payoutId: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        batchId: batch._id,
        payeeId: li.partyId,
        payeeName: li.partyName,
        payeeType: li.partyType,
        grossAmount: li.grossAmount,
        deductions: {
          platformFee: li.platformFee,
          taxes: 0, // TDS logic placeholder
          disputeAdjustments: li.disputeAdjustments
        },
        netPayable: li.netPayable,
        payoutMethod: 'IMPS',
        bankDetails: {
          bankName: org.primaryBankAccount?.bankName || 'N/A',
          accountNumber: org.primaryBankAccount?.accountNumber || 'N/A',
          ifsc: org.primaryBankAccount?.ifsc || 'N/A',
          accountHolder: org.primaryBankAccount?.accountHolderName || org.legalName
        },
        status: isTestMode ? 'CONFIRMED' : 'INITIATED',
        initiatedAt: new Date()
      };

      if (isTestMode) {
        payoutData.confirmedAt = new Date();
        payoutData.bankReference = `TEST-REF-${Date.now()}`;
        payoutData.utrs = [`TEST-UTR-${Date.now()}`];
      }

      const payout = new this.payoutModel(payoutData);
      const savedPayout = await payout.save();
      
      li.payoutId = savedPayout._id as any;
      li.status = 'PAID';
      payouts.push(savedPayout);
    }

    batch.status = 'PAID';
    batch.payoutExecutedAt = new Date();
    batch.statusTimeline.push({ status: 'PAID', timestamp: new Date() });
    await batch.save();

    this.auditService.log({
      action: 'SETTLEMENT_PAID',
      module: 'SETTLEMENT',
      entityType: 'SETTLEMENT_BATCH',
      entityId: batch._id as any,
      entityIdStr: batchId,
      actorId: adminId,
      afterState: { batchId, payoutCount: payouts.length, mode: isTestMode ? 'TEST' : 'PRODUCTION' },
      description: `Settlement batch ${batchId} processed — ${payouts.length} payouts executed`,
    });

    return { 
      batchId, 
      executedBy: adminId, 
      payoutCount: payouts.length, 
      payouts,
      mode: isTestMode ? 'TEST' : 'PRODUCTION'
    };
  }

  async findPayoutsByPayeeId(
    payeeId: string,
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ) {
    return this.payoutModel
      .find({ payeeId: new Types.ObjectId(payeeId), ...filters })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findPayoutByIdOrFail(id: string) {
    const payout = await this.payoutModel.findById(id);
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  async confirmPayout(
    id: string,
    body: { bankReference: string; utrs: string[] }
  ) {
    const payout = await this.findPayoutByIdOrFail(id);
    payout.status = 'CONFIRMED';
    payout.confirmedAt = new Date();
    payout.bankReference = body.bankReference;
    payout.utrs = body.utrs;
    return payout.save();
  }

  async getSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const batches = await this.settlementBatchModel.find({
      createdAt: { $gte: start, $lte: end },
      status: 'PAID'
    });

    // Calculate total escrow currently held
    const escrowStats = await this.paymentsService.findAll({ escrowHoldStatus: 'ACTIVE' }, 1, 1000);
    const totalEscrowHold = escrowStats.reduce((sum, p) => sum + p.escrowHoldAmount, 0);

    return {
      startDate,
      endDate,
      batchCount: batches.length,
      totalDisbursed: batches.reduce((sum, b) => sum + b.totals.netPayable, 0),
      totalFees: batches.reduce((sum, b) => sum + b.totals.platformFees, 0),
      totalEscrowHold
    };
  }

  async getHistoryByPayeeId(payeeId: string) {
    return this.payoutModel.find({ payeeId: new Types.ObjectId(payeeId) }).sort({ createdAt: -1 });
  }

  async findAllBatches(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ) {
    return this.settlementBatchModel
      .find(filters)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  async findBatchByIdOrFail(id: string) {
    const batch = await this.settlementBatchModel.findById(id);
    if (!batch) throw new NotFoundException('Settlement batch not found');
    return batch;
  }
}
