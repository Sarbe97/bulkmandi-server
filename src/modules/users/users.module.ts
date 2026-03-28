import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './services/user-dashboard.service';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Shipment, ShipmentSchema } from '../shipments/schemas/shipment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
  ],
  controllers: [UsersController, UserDashboardController],
  providers: [UsersService, UserDashboardService],
  exports: [UsersService],
})
export class UsersModule {}
