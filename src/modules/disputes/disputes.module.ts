import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersModule } from '../orders/orders.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { Dispute, DisputeSchema } from './schemas/dispute.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Dispute.name, schema: DisputeSchema },
    ]),
    OrdersModule,
    ShipmentsModule,
    OrganizationsModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
