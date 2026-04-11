import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rfq, RfqDocument } from '../../rfq/schemas/rfq.schema';
import { Quote, QuoteDocument } from '../../quotes/schemas/quote.schema';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { Shipment, ShipmentDocument } from '../../shipments/schemas/shipment.schema';
import { ShipmentRfq, ShipmentRfqDocument } from '../../shipments/schemas/shipment-rfq.schema';
import { ShipmentBid, ShipmentBidDocument } from '../../shipments/schemas/shipment-bid.schema';
import { AuditService } from '../../audit/audit.service';
import { ActivityTransformService } from '../../audit/services/activity-transform.service';
import { ShipmentRfqStatus, ShipmentBidStatus } from '@common/enums';

@Injectable()
export class UserDashboardService {
  constructor(
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(ShipmentRfq.name) private shipmentRfqModel: Model<ShipmentRfqDocument>,
    @InjectModel(ShipmentBid.name) private shipmentBidModel: Model<ShipmentBidDocument>,
    private readonly auditService: AuditService,
    private readonly transformService: ActivityTransformService,
  ) {}

  async getStats(role: string, organizationIdStr: string) {
    if (!organizationIdStr) {
      return this.defaultStats();
    }
    
    const organizationId = new Types.ObjectId(organizationIdStr);

    switch (role) {
      case 'BUYER':
        return this.getBuyerStats(organizationId);
      case 'SELLER':
        return this.getSellerStats(organizationId);
      case 'LOGISTIC':
        return this.getLogisticStats(organizationId);
      default:
        return this.defaultStats();
    }
  }

  async getActivityFeed(role: string, organizationIdStr: string, userId: string, limit = 10) {
    const filters: any = { limit };
    
    // Policy: Recent activity should prioritize the user's own actions (actorId)
    // to keep the dashboard feed clean of redundant organization-wide events.
    if (userId) {
      filters.actorId = userId;
    }
    
    // Maintain organization context for Sellers (to see new RFQs) but keep it clean for Buyers
    if (role !== 'BUYER' && organizationIdStr) {
      filters.targetOrgId = organizationIdStr;
    }

    const { data: logs } = await this.auditService.query(filters);
    
    return logs
      .map(log => this.transformService.transform(log, role))
      .filter(item => item !== null);
  }

  private async getBuyerStats(organizationId: Types.ObjectId) {
    const activeRfqs = await this.rfqModel.countDocuments({ buyerId: organizationId, status: 'OPEN' });

    // Pending Quotes references Rfqs owned by buyerId, so we can do an aggregation or just query quotes if order isn't placed
    // Actually simpler: lookup quotes where buyer is not explicitly defined but linked via RFQ, or if quotes have buyerId?
    // Let's assume Quotes have buyerId, if not, we use aggregation. We'll use aggregation to be safe.
    const pendingQuotesAgg = await this.rfqModel.aggregate([
      { $match: { buyerId: organizationId } },
      { $lookup: { from: 'quotes', localField: '_id', foreignField: 'rfqId', as: 'quotes' } },
      { $unwind: '$quotes' },
      { $match: { 'quotes.status': 'PENDING' } },
      { $count: 'pendingQuotes' }
    ]);
    const pendingQuotes = pendingQuotesAgg[0]?.pendingQuotes || 0;

    const openOrders = await this.orderModel.countDocuments({ 
      buyerId: organizationId, 
      status: { $in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } 
    });

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0,0,0,0);
    const monthlySpendAgg = await this.orderModel.aggregate([
      { $match: { buyerId: organizationId, createdAt: { $gte: currentMonth } } },
      { $group: { _id: null, totalSpend: { $sum: '$totalAmount' } } }
    ]);
    const monthlySpend = monthlySpendAgg[0]?.totalSpend || 0;

    return {
      activeRfqs: activeRfqs,
      pendingQuotes: pendingQuotes,
      openOrders: openOrders,
      monthlySpend: monthlySpend
    };
  }

  private async getSellerStats(organizationId: Types.ObjectId) {
    const activeQuotes = await this.quoteModel.countDocuments({ sellerId: organizationId, status: 'PENDING' });

    const ordersFulfilled = await this.orderModel.countDocuments({ 
      sellerId: organizationId, 
      status: { $in: ['DELIVERED', 'COMPLETED'] } 
    });

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0,0,0,0);
    const monthlyRevenueAgg = await this.orderModel.aggregate([
      { $match: { sellerId: organizationId, status: { $in: ['DELIVERED', 'COMPLETED'] }, createdAt: { $gte: currentMonth } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);
    const monthlyRevenue = monthlyRevenueAgg[0]?.totalRevenue || 0;

    return {
      monthlyRevenue: monthlyRevenue,
      activeQuotes: activeQuotes,
      ordersFulfilled: ordersFulfilled,
      sellerRating: 4.8 // Mocked due to missing review schema
    };
  }

  private async getLogisticStats(organizationId: Types.ObjectId) {
    const activeShipments = await this.shipmentModel.countDocuments({
      logisticPartnerId: organizationId,
      status: { $in: ['DISPATCHED', 'IN_TRANSIT'] }
    });

    const pendingPickups = await this.shipmentModel.countDocuments({
      logisticPartnerId: organizationId,
      status: 'ASSIGNED'
    });

    const activeVehicles = 8; // Mocked for now

    const issues = await this.shipmentModel.countDocuments({
      carrierId: organizationId,
      status: 'ISSUE_REPORTED' // TODO: Define in ShipmentStatus enum if available
    });

    const openShipmentRfqs = await this.shipmentRfqModel.countDocuments({
      status: ShipmentRfqStatus.OPEN
    });

    const pendingBids = await this.shipmentBidModel.countDocuments({
      carrierId: organizationId,
      status: 'SUBMITTED' // Needs ShipmentBidStatus enum
    });

    return {
      activeShipments: activeShipments,
      pendingPickups: pendingPickups,
      activeVehicles: activeVehicles,
      issues: issues,
      openShipmentRfqs,
      pendingBids
    };
  }

  private defaultStats() {
    return {
      activeRfqs: 0, pendingQuotes: 0, openOrders: 0, monthlySpend: 0,
      monthlyRevenue: 0, activeQuotes: 0, ordersFulfilled: 0, sellerRating: 0,
      activeShipments: 0, pendingPickups: 0, activeVehicles: 0, issues: 0
    };
  }
}
