import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { KycController } from './kyc.controller';
import { KycCase, KycCaseSchema } from './schemas/kyc.schema';
import { KycAdminService } from './services/kyc-admin.service';
import { KycCaseService } from './services/kyc.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCase.name, schema: KycCaseSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  controllers: [KycController],
  providers: [KycCaseService, KycAdminService],
  exports: [KycCaseService, KycAdminService, MongooseModule],
})
export class KycModule {}
