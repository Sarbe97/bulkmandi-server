import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycCase, KycCaseSchema } from '../kyc/schemas/kyc.schema';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminController } from './controllers/admin.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCase.name, schema: KycCaseSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    OrganizationsModule, // ✅ Added OrganizationsModule
  ],
  controllers: [AdminDashboardController, AdminController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminModule { }
