import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycCase, KycCaseSchema } from '../kyc/schemas/kyc.schema';
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
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminModule {}
