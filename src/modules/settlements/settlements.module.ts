import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
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
    ConfigModule,
    OrdersModule,
    PaymentsModule,
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
