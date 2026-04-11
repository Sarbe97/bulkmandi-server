import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { Quote, QuoteSchema } from './schemas/quote.schema';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quote.name, schema: QuoteSchema }]),
    MongooseModule.forFeature([{ name: Rfq.name, schema: RfqSchema }]),
    forwardRef(() => OrdersModule),
    OrganizationsModule,
    MasterDataModule,
    AuthModule,
    AuditModule,
    UsersModule,
    NotificationsModule,
  ],

  providers: [QuotesService],
  controllers: [QuotesController],
  exports: [QuotesService],
})
export class QuotesModule { }
