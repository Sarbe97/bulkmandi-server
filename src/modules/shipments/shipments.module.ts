import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PaymentsModule } from '../payments/payments.module';
import { Shipment, ShipmentSchema } from './schemas/shipment.schema';
import { ShipmentRfq, ShipmentRfqSchema } from './schemas/shipment-rfq.schema';
import { ShipmentBid, ShipmentBidSchema } from './schemas/shipment-bid.schema';
import { SellerPreference, SellerPreferenceSchema } from '../preferences/schemas/seller-preference.schema';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: ShipmentRfq.name, schema: ShipmentRfqSchema },
      { name: ShipmentBid.name, schema: ShipmentBidSchema },
      { name: SellerPreference.name, schema: SellerPreferenceSchema },
    ]),
    forwardRef(() => OrdersModule),
    OrganizationsModule,
    forwardRef(() => PaymentsModule),
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
