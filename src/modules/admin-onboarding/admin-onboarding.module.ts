import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminOnboardingController } from './admin-onboarding.controller';
import { AdminOnboardingService } from './admin-onboarding.service';
import { AuthModule } from '../auth/auth.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    OrganizationsModule,
    AuthModule,
    PreferencesModule,
  ],
  controllers: [AdminOnboardingController],
  providers: [AdminOnboardingService],
})
export class AdminOnboardingModule {}
