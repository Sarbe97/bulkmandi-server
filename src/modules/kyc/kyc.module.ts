import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { IdGeneratorService } from '../../common/services/id-generator.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { KycController } from './kyc.controller';
import { KycCase, KycCaseSchema } from './schemas/kyc.schema';
import { KycAdminService } from './services/kyc-admin.service';
import { KycHelperService } from './services/kyc.helper.service';
import { KycCaseService } from './services/kyc.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCase.name, schema: KycCaseSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [KycController],
  providers: [KycCaseService, KycAdminService, KycHelperService, IdGeneratorService], // ✅ Added IdGeneratorService
  exports: [KycCaseService, KycAdminService, MongooseModule],
})
export class KycModule { }
