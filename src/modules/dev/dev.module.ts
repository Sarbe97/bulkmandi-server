import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevService } from './dev.service';
import { DevController } from './dev.controller';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { SettlementBatch, SettlementBatchSchema } from '../settlements/schemas/settlement-batch.schema';
import { Payout, PayoutSchema } from '../settlements/schemas/payout.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: SettlementBatch.name, schema: SettlementBatchSchema },
      { name: Payout.name, schema: PayoutSchema },
    ]),
  ],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
