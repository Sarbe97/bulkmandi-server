import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycController } from '../kyc/kyc.controller';
import { KycCase, KycCaseSchema } from '../kyc/schemas/kyc.schema';
import { KycAdminService } from '../kyc/services/kyc-admin.service';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCase.name, schema: KycCaseSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  controllers: [AdminDashboardController, KycController],
  providers: [AdminDashboardService, KycAdminService],
  exports: [AdminDashboardService, KycAdminService],
})
export class AdminModule {}
