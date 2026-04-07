import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycCase, KycCaseSchema } from '../kyc/schemas/kyc.schema';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminController } from './controllers/admin.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { RfqModule } from '../rfq/rfq.module';
import { QuotesModule } from '../quotes/quotes.module';
import { PaymentsModule } from '../payments/payments.module';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { ShipmentRfq, ShipmentRfqSchema } from '../shipments/schemas/shipment-rfq.schema';
import { ShipmentBid, ShipmentBidSchema } from '../shipments/schemas/shipment-bid.schema';
import { Dispute, DisputeSchema } from '../disputes/schemas/dispute.schema';
import { SettlementBatch, SettlementBatchSchema } from '../settlements/schemas/settlement-batch.schema';
import { SettlementsAdminController } from './controllers/settlements-admin.controller';
import { SettlementsAdminService } from './services/settlement-admin.service';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCase.name, schema: KycCaseSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ShipmentRfq.name, schema: ShipmentRfqSchema },
      { name: ShipmentBid.name, schema: ShipmentBidSchema },
      { name: Dispute.name, schema: DisputeSchema },
      { name: SettlementBatch.name, schema: SettlementBatchSchema },
    ]),
    OrganizationsModule,
    RfqModule,
    QuotesModule,
    PaymentsModule,
    forwardRef(() => SettlementsModule),
  ],
  controllers: [AdminDashboardController, AdminController, SettlementsAdminController],
  providers: [AdminDashboardService, SettlementsAdminService],
  exports: [AdminDashboardService],
})
export class AdminModule { }
