import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { SettlementBatch, SettlementBatchDocument } from '../settlements/schemas/settlement-batch.schema';
import { Payout, PayoutDocument } from '../settlements/schemas/payout.schema';

@Injectable()
export class DevService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(SettlementBatch.name) private batchModel: Model<SettlementBatchDocument>,
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
    private configService: ConfigService,
  ) {}

  private checkDevMode() {
    if (this.configService.get('TEST_MODE') !== 'true') {
      throw new ForbiddenException('Dev Mode is not enabled in .env');
    }
  }

  /**
   * DEV ONLY: Resets an order to CONFIRMED stage
   * Clears payment info, shipment links, and resets lifecycle.
   */
  async resetOrder(orderId: string) {
    this.checkDevMode();
    const order = await this.orderModel.findOne({ orderId });
    if (!order) throw new NotFoundException('Order not found');

    order.status = 'CONFIRMED';
    order.lifecycle = { confirmedAt: new Date() };
    order.payment = {
      escrowReleased: false
    };
    order.shipmentIds = [];
    order.shipmentCount = 0;
    order.hasDispute = false;
    order.disputeIds = [];

    return order.save();
  }

  /**
   * DEV ONLY: Resets a settlement batch to READY stage
   * Deletes all associated payouts and resets line item statuses.
   */
  async resetBatch(batchId: string) {
    this.checkDevMode();
    const batch = await this.batchModel.findOne({ batchId });
    if (!batch) throw new NotFoundException('Batch not found');

    // Delete associated payouts
    await this.payoutModel.deleteMany({ batchId: batch._id });

    // Reset batch status
    batch.status = 'READY';
    batch.statusTimeline = [{ status: 'READY', timestamp: new Date() }];
    batch.payoutExecutedAt = undefined;

    // Reset line items
    batch.lineItems.forEach(li => {
      li.status = 'READY';
      li.payoutId = undefined;
      li.payoutAt = undefined;
    });

    return batch.save();
  }
}
