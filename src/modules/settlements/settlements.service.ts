import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
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
import { MasterDataService } from "../master-data/master-data.service";
import { NotificationsService } from "../notifications/notifications.service";
import { 
  AuditAction, 
  AuditModule, 
  AuditEntityType, 
  LogisticsPreference 
} from "src/common/constants/app.constants";
import { ShipmentsService } from "../shipments/shipments.service";
import { IdGeneratorService } from "src/common/services/id-generator.service";

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
    @Inject(forwardRef(() => ShipmentsService)) private readonly shipmentsService: ShipmentsService,
    private readonly masterDataService: MasterDataService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) { }


  async createBatch(dto: CreateBatchDto, adminId: string) {
    this.logger.log(`Creating settlement batch by admin: ${adminId} for ${dto.orderIds.length} orders`);
    const orders = await Promise.all(
      dto.orderIds.map(id => this.ordersService.findByIdOrFail(id))
    );

    // Grouping by party (Seller/3PL)
    const partyMap = new Map<string, any>();

    const platformConfig = await this.masterDataService.getPlatformConfig();
    const feeRate = platformConfig?.platformFeeRate ?? 0.02;

    for (const order of orders) {
      // 0. Safety Check: Skip orders with active disputes or paused timers
      const hasActiveDispute = order.disputeIds && order.disputeIds.length > 0;
      const isTimerPaused = order.payoutTimer && order.payoutTimer.status === 'PAUSED';

      if (hasActiveDispute || isTimerPaused) {
        this.logger.warn(`Skipping order ${order.orderId} due to active dispute or paused timer`);
        continue;
      }

      // 1. Determine Payout Parties based on Logistics Preference
      const isPlatformManaged = order.logisticsPreference === LogisticsPreference.PLATFORM_3PL;
      
      // Seller Payout (Product Value)
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
      
      if (isPlatformManaged) {
        // Seller only gets the material value (The platform handles freight separately)
        sellerEntry.grossAmount += order.pricing.baseAmount + order.pricing.taxAmount;
      } else {
        // Seller gets everything (DAP/DDP model)
        sellerEntry.grossAmount += order.pricing.baseAmount + order.pricing.freightTotal + order.pricing.taxAmount;
      }
      
      // Platform fee is usually calculated on material base amount
      sellerEntry.platformFee += (order.pricing.baseAmount * feeRate);

      // 2. Logistics Payout logic (New: 3PL Allocation)
      if (isPlatformManaged) {
        // Find the accepted shipment for this order to get the carrier and bid amount
        const shipment = await this.shipmentsService.findByOrderId(order._id.toString());
        if (shipment && shipment.carrierId) {
          const carrierId = shipment.carrierId.toString();
          if (!partyMap.has(carrierId)) {
            // Need to fetch carrier name
            const carrierOrg = await this.orgService.getOrganization(carrierId);
            partyMap.set(carrierId, {
              partyId: shipment.carrierId,
              partyName: carrierOrg?.legalName || 'Logistics Partner',
              partyType: 'LOGISTIC',
              orders: [],
              grossAmount: 0,
              platformFee: 0,
              disputeAdjustments: 0,
            });
          }
          
          const carrierEntry = partyMap.get(carrierId);
          carrierEntry.orders.push(order.orderId);
          // Carrier gets the EXACT freight amount agreed in the shipment (winning bid)
          carrierEntry.grossAmount += shipment.pricing?.freightAmount || order.pricing.freightTotal;
        }
      }
    }


    const lineItems = Array.from(partyMap.values()).map(item => ({
      ...item,
      lineItemId: this.idGenerator.generateBusinessId('LI'),
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
      batchId: this.idGenerator.generateBusinessId('SET'),
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
      action: AuditAction.SETTLEMENT_CREATED,
      module: AuditModule.SETTLEMENT,
      entityType: AuditEntityType.SETTLEMENT,
      entityId: saved._id as any,
      entityIdStr: saved.batchId,
      actorId: adminId,
      afterState: { batchId: saved.batchId, orderCount: dto.orderIds.length, netPayable: saved.totals?.netPayable },
      description: `Settlement batch ${saved.batchId} created by admin with ${dto.orderIds.length} orders`,
    });

    return saved;
  }

  async runPayouts(batchId: string, adminId: string) {
    this.logger.log(`Executing payouts for batch: ${batchId} by admin: ${adminId}`);
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
        payoutId: this.idGenerator.generateBusinessId('PO', org?.orgCode),
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
        payoutData.bankReference = this.idGenerator.generateBusinessId('TEST-REF');
        payoutData.utrs = [this.idGenerator.generateBusinessId('TEST-UTR')];
      }

      const payout = new this.payoutModel(payoutData);
      const savedPayout = await payout.save();
      
      li.payoutId = savedPayout._id as any;
      li.status = 'PAID';
      payouts.push(savedPayout);

      // ✅ Notify Seller: Payout Executed
      try {
        const users = await this.orgService.getOrganizationUsers(li.partyId.toString());
        for (const user of users) {
          await this.notificationsService.notify(
            user._id.toString(),
            "💰 Payout Processed",
            `A payout of ₹${li.netPayable.toLocaleString()} has been processed for your settled orders.`,
            {
              template: "order-status",
              data: {
                orderId: "Multiple (Batch)",
                status: "PAID",
                type: "PAYOUT ALERT",
                remarks: `Batch ID: ${batch.batchId}. Net Payable: ₹${li.netPayable.toLocaleString()}.`,
                orderUrl: `${process.env.FRONTEND_URL}/seller/payouts`,
              },
              category: "PAYMENT",
            }
          );
        }
      } catch (notifyErr) {
        this.logger.error(`Failed to dispatch payout notification for ${li.partyName}: ${notifyErr.message}`);
      }
    }

    batch.status = 'PAID';
    batch.payoutExecutedAt = new Date();
    batch.statusTimeline.push({ status: 'PAID', timestamp: new Date() });
    await batch.save();

    this.auditService.log({
      action: AuditAction.SETTLEMENT_PAID,
      module: AuditModule.SETTLEMENT,
      entityType: AuditEntityType.SETTLEMENT,
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

  /**
   * Operations Command Center: Process all orders pending settlement
   * This is a batch process that can be triggered by Admin or a Cron.
   */
  async processAutomatedSettlementQueue(adminId: string) {
    this.logger.log(`Processing automated settlement queue by admin: ${adminId}`);
    
    // Find orders in DELIVERED status with a RUNNING timer
    const orders = await this.ordersService.findAllPendingSettlement();
    const settledOrderIds: string[] = [];

    for (const order of orders) {
      if (!order.payoutTimer || order.payoutTimer.status !== 'RUNNING') continue;

      const now = new Date();
      const lastTick = order.payoutTimer.lastTickedAt ? new Date(order.payoutTimer.lastTickedAt) : now;
      const elapsed = now.getTime() - lastTick.getTime();
      const remaining = Math.max(0, order.payoutTimer.remainingMs - elapsed);

      if (remaining <= 0) {
        // Timeline expired! Auto-settle.
        try {
          await this.ordersService.acceptDelivery(order._id.toString(), order.buyerId.toString());
          settledOrderIds.push(order.orderId);
          this.logger.log(`Automated settlement successful for order: ${order.orderId}`);
        } catch (err) {
          this.logger.error(`Automated settlement failed for order ${order.orderId}: ${err.message}`);
        }
      } else {
        // Update timer state
        order.payoutTimer.remainingMs = remaining;
        order.payoutTimer.lastTickedAt = now;
        await (order as any).save();
      }
    }

    return {
      processedCount: orders.length,
      autoSettledCount: settledOrderIds.length,
      settledOrderIds
    };
  }

  async forceReleaseStage2(orderId: string, adminId: string) {
    this.logger.log(`Admin ${adminId} forcing Stage 2 release for order: ${orderId}`);
    const order = await this.ordersService.findByIdOrFail(orderId);
    
    // Override logic
    return this.ordersService.acceptDelivery(orderId, order.buyerId.toString());
  }

  async extendSettlementBuffer(orderId: string, hours: number, adminId: string) {
    this.logger.log(`Admin ${adminId} extending buffer for order ${orderId} by ${hours} hours`);
    const order = await this.ordersService.findByIdOrFail(orderId);
    if (!order.payoutTimer) throw new BadRequestException('No active settlement timer found');

    const extensionMs = hours * 60 * 60 * 1000;
    order.payoutTimer.remainingMs += extensionMs;
    await (order as any).save();

    this.auditService.log({
      action: AuditAction.SETTLEMENT_TIMER_EXTENDED,
      module: AuditModule.SETTLEMENT,
      entityType: AuditEntityType.ORDER,
      entityId: order._id as any,
      entityIdStr: order.orderId,
      actorId: adminId,
      afterState: { addedHours: hours, newRemainingMs: order.payoutTimer.remainingMs },
      description: `Settlement window extended by ${hours} hours by Admin`,
    });

    return order;
  }
}
