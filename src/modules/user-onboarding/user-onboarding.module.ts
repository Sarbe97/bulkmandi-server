// server/src/modules/user-onboarding/user-onboarding.module.ts

import { KycModule } from '@modules/kyc/kyc.module';
import { Organization, OrganizationSchema } from '@modules/organizations/schemas/organization.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserOnboardingController } from './controllers/user-onboarding.controller';
import { UserOnboardingService } from './services/user-onboarding.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    KycModule,
  ],
  controllers: [UserOnboardingController],
  providers: [UserOnboardingService],
  exports: [UserOnboardingService],
})
export class UserOnboardingModule {}
