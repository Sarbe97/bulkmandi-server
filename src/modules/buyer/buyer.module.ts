import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { RfqModule } from '../rfq/rfq.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';

@Module({
  imports: [
    RfqModule,
    QuotesModule,
    OrdersModule,
    PaymentsModule,
    ShipmentsModule,
    DisputesModule,
    OrganizationsModule,
  ],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
