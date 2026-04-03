import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KycCase, KycCaseDocument } from '../../kyc/schemas/kyc.schema';
import { Organization, OrganizationDocument } from '../../organizations/schemas/organization.schema';
import { Rfq, RfqDocument } from '../../rfq/schemas/rfq.schema';
import { Quote, QuoteDocument } from '../../quotes/schemas/quote.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { Dispute, DisputeDocument } from '../../disputes/schemas/dispute.schema';
import { SettlementBatch, SettlementBatchDocument } from '../../settlements/schemas/settlement-batch.schema';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Dispute.name) private disputeModel: Model<DisputeDocument>,
    @InjectModel(SettlementBatch.name) private batchModel: Model<SettlementBatchDocument>,
    private readonly logger: CustomLoggerService,
  ) {}

  async getDashboardStats() {
    this.logger.log('Fetching admin dashboard statistics');
    // KYC Statistics
    const kycPendingStatuses = ['SUBMITTED', 'INFO_REQUESTED', 'REVISION_REQUESTED'];
    const kycPending = await this.kycCaseModel.countDocuments({ status: { $in: kycPendingStatuses } });
    
    const kycByRole = await this.kycCaseModel.aggregate([
      { $match: { status: { $in: kycPendingStatuses } } },
      { 
        $lookup: {
          from: 'organizations',
          localField: 'organizationId',
          foreignField: '_id',
          as: 'org'
        }
      },
      { $unwind: '$org' },
      {
        $group: {
          _id: '$org.role',
          count: { $sum: 1 }
        }
      }
    ]);

    const kycBreakdown = {
      buyers: kycByRole.find(r => r._id === 'BUYER')?.count || 0,
      sellers: kycByRole.find(r => r._id === 'SELLER')?.count || 0,
      threepl: kycByRole.find(r => r._id === 'LOGISTIC')?.count || 0,
    };

    // RFQ & Quote Statistics
    const totalRfqs = await this.rfqModel.countDocuments();
    const openRfqs = await this.rfqModel.countDocuments({ status: 'OPEN' });
    const totalQuotes = await this.quoteModel.countDocuments();
    const acceptedQuotes = await this.quoteModel.countDocuments({ status: 'ACCEPTED' });

    // Settlement & Escrow Statistics
    const escrowStats = await this.paymentModel.aggregate([
      {
        $group: {
          _id: null,
          totalHold: { 
            $sum: { $cond: [{ $eq: ["$escrowHoldStatus", "ACTIVE"] }, "$escrowHoldAmount", 0] } 
          },
          stage1Hold: { 
            $sum: { $cond: [{ $eq: ["$escrowStage1Status", "PENDING"] }, "$escrowStage1Amount", 0] } 
          },
          stage2Hold: { 
            $sum: { $cond: [{ $eq: ["$escrowStage2Status", "PENDING"] }, "$escrowStage2Amount", 0] } 
          },
          releasedToday: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ["$escrowHoldStatus", "RELEASED"] },
                    { $gte: ["$escrowReleaseAt", new Date(new Date().setHours(0,0,0,0))] }
                  ] 
                }, 
                "$escrowHoldAmount", 
                0
              ] 
            }
          }
        }
      }
    ]);

    const escrow = escrowStats[0] || { totalHold: 0, stage1Hold: 0, stage2Hold: 0, releasedToday: 0 };

    const totalDisputes = await this.disputeModel.countDocuments();
    const newDisputes = await this.disputeModel.countDocuments({ status: 'NEW' });
    const reviewDisputes = await this.disputeModel.countDocuments({ status: 'IN_REVIEW' });
    const openDisputes = newDisputes + reviewDisputes;
    
    // Check SLA Escalated
    const escalatedDisputes = await this.disputeModel.countDocuments({ 
      status: { $in: ['NEW', 'IN_REVIEW'] }, 
      slaDeadline: { $lt: new Date() } 
    });

    // Batches
    const pendingBatches = await this.batchModel.countDocuments({ status: { $in: ['DRAFT', 'READY', 'PROCESSING'] } });

    return {
      kyc: {
        pending: kycPending,
        breakdown: kycBreakdown,
      },
      priceFlags: {
        total: totalRfqs + totalQuotes,
        rfqs: totalRfqs,
        quotes: totalQuotes,
        openRfqs,
        acceptedQuotes,
      },
      disputes: {
        open: openDisputes,
        new: newDisputes,
        inReview: reviewDisputes,
        escalated: escalatedDisputes,
      },
      settlements: {
        todayPayouts: escrow.releasedToday,
        totalEscrowHold: escrow.totalHold,
        escrowBreakdown: {
          stage1: escrow.stage1Hold,
          stage2: escrow.stage2Hold,
        },
        reconDiff: 0,
        pendingBatches: pendingBatches,
        exceptions: 0,
      },
    };
  }
}
