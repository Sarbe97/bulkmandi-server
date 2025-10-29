import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { QuotesModule } from '../quotes/quotes.module';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { RfqModule } from '../rfq/rfq.module';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';

@Module({
  imports: [
    MongooseModule.forFeature([
          { name: Rfq.name, schema: RfqSchema },
          { name: Quote.name, schema: QuoteSchema },

          
        ]),
    RfqModule,
    QuotesModule,
    OrdersModule,
    ShipmentsModule,
    CatalogModule,
    OrganizationsModule,
  ],
  controllers: [SellerController],
  providers: [SellerService],
  exports: [SellerService],
})
export class SellerModule {}
