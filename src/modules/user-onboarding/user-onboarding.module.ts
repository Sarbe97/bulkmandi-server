// server/src/modules/user-onboarding/user-onboarding.module.ts

import { KycModule } from '@modules/kyc/kyc.module';
import { Organization, OrganizationSchema } from '@modules/organizations/schemas/organization.schema';
import { User, UserSchema } from '@modules/users/schemas/user.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserOnboardingController } from './controllers/user-onboarding.controller';
import { UserOnboardingService } from './services/user-onboarding.service';

import { IdGeneratorService } from 'src/common/services/id-generator.service';

import { OrgKycStepService } from './services/steps/org-kyc-step.service';
import { BankDetailsStepService } from './services/steps/bank-details-step.service';
import { ComplianceStepService } from './services/steps/compliance-step.service';
import { IntegrationsModule } from '@modules/integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    KycModule,
    IntegrationsModule, // ✅ Added IntegrationsModule
  ],
  controllers: [UserOnboardingController],
  providers: [
    UserOnboardingService,
    IdGeneratorService,
    OrgKycStepService,
    BankDetailsStepService,
    ComplianceStepService,
  ],
  exports: [UserOnboardingService],
})
export class UserOnboardingModule { }
