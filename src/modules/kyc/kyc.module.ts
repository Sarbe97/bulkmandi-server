import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { KycAdminService } from './kyc-admin.service';
import { KycController } from './kyc.controller';
import { KycCaseService } from './kyc.service';
import { KycCase, KycCaseSchema } from './schemas/kyc.schema';

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
