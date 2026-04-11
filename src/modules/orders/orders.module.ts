import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PaymentsModule } from '../payments/payments.module';
import { DisputesModule } from '../disputes/disputes.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RfqModule } from '../rfq/rfq.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
    ]),
    forwardRef(() => QuotesModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => DisputesModule),
    forwardRef(() => ShipmentsModule),
    RfqModule,
    OrganizationsModule,
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule { }
