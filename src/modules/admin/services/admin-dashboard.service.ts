import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KycCase, KycCaseDocument } from 'src/modules/kyc/schemas/kyc.schema';
import { Organization, OrganizationDocument } from '../../organizations/schemas/organization.schema';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) {}

  async getDashboardStats() {
    // KYC Statistics
    const kycPending = await this.kycCaseModel.countDocuments({ status: 'SUBMITTED' });
    
    const kycByRole = await this.kycCaseModel.aggregate([
      { $match: { status: 'SUBMITTED' } },
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
      threepl: kycByRole.find(r => r._id === '3PL')?.count || 0,
    };

    return {
      kyc: {
        pending: kycPending,
        breakdown: kycBreakdown,
      },
      priceFlags: {
        total: 12, // TODO: Implement when RFQ/Quote module ready
        rfqs: 5,
        quotes: 7,
      },
      disputes: {
        open: 7, // TODO: Implement when Dispute module ready
        new: 3,
        inReview: 2,
        escalated: 2,
      },
      settlements: {
        todayPayouts: 12400000, // TODO: Implement when Settlement module ready
        reconDiff: 0,
        pendingBatches: 2,
        exceptions: 1,
      },
    };
  }
}
