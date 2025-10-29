import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from '../shipments/schemas/shipment.schema';
import { ThreePLController } from './3pl.controller';
import { ThreePLService } from './3pl.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Shipment.name, schema: ShipmentSchema }])
  ],
  providers: [ThreePLService],
  controllers: [ThreePLController],
  exports: [ThreePLService]
})
export class ThreePLModule {}
