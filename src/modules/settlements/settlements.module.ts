import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { SettlementBatch, SettlementBatchSchema } from './schemas/settlement-batch.schema';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SettlementBatch.name, schema: SettlementBatchSchema },
      { name: Payout.name, schema: PayoutSchema },
    ]),
    OrdersModule,
    OrganizationsModule,
  ],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
