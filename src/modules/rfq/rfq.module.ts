import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { Rfq, RfqSchema } from './schemas/rfq.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rfq.name, schema: RfqSchema },
    ]),
    OrganizationsModule,
    CatalogModule,
    AuthModule,
  ],


  controllers: [RfqController],
  providers: [RfqService],
  exports: [RfqService],
})
export class RfqModule { }
