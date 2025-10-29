import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycAdminService } from '../kyc/kyc-admin.service';
import { KycModule } from '../kyc/kyc.module';
import { QuotesModule } from '../quotes/quotes.module';
import { RfqModule } from '../rfq/rfq.module';
import { SettlementBatch, SettlementBatchSchema } from '../settlements/schemas/settlement-batch.schema';
import { SettlementsModule } from '../settlements/settlements.module';
import { KycAdminController } from './controllers/kyc-admin.controller';
import { PriceMonitorController } from './controllers/price-monitor.controller';
import { SettlementsAdminController } from './controllers/settlements-admin.controller';
import { PriceIndex, PriceIndexSchema } from './schemas/price-index.schema';
import { PriceMonitorService } from './services/price-monitor.service';
import { SettlementsAdminService } from './services/settlement-admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PriceIndex.name, schema: PriceIndexSchema },
      { name: SettlementBatch.name, schema: SettlementBatchSchema },
    ]),
    KycModule,
    SettlementsModule,
    QuotesModule,
    RfqModule,
  ],
  controllers: [
    KycAdminController,
    PriceMonitorController,
    SettlementsAdminController,
  ],
  providers: [
    KycAdminService,
    PriceMonitorService,
    SettlementsAdminService,
  ],
  exports: [
    KycAdminService,
    PriceMonitorService,
    SettlementsAdminService,
  ],
})
export class AdminModule {}
