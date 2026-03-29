import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

// Keep Auth (existing)
import { AuthModule } from "./modules/auth/auth.module";

// New modules
import { UserOnboardingModule } from "@modules/user-onboarding/user-onboarding.module";
import { CoreModule } from "./core/core.module";
import { DatabaseModule } from "./core/database/database.module";
import { AdminModule } from "./modules/admin/admin.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { MasterDataModule } from './modules/master-data/master-data.module';
import { UsersModule } from "./modules/users/users.module";
import { RfqModule } from "@modules/rfq/rfq.module";
import { QuotesModule } from "@modules/quotes/quotes.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ShipmentsModule } from "./modules/shipments/shipments.module";
import { DisputesModule } from "./modules/disputes/disputes.module";
import { SettlementsModule } from "./modules/settlements/settlements.module";
import { AuditModule } from "./modules/audit/audit.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PreferencesModule } from "./modules/preferences/preferences.module";
import { AdminOnboardingModule } from './modules/admin-onboarding/admin-onboarding.module';
import { DevModule } from './modules/dev/dev.module';
import { OtpModule } from './modules/otp/otp.module';
import { NegotiationsModule } from './modules/negotiations/negotiations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    CoreModule,
    OrganizationsModule,
    KycModule,
    UserOnboardingModule,
    AdminModule,
    DocumentsModule,
    MasterDataModule,
    UsersModule,
    RfqModule,
    QuotesModule,
    IntegrationsModule,
    OrdersModule,
    PaymentsModule,
    ShipmentsModule,
    DisputesModule,
    SettlementsModule,
    DevModule,
    // BuyerModule, // Not found
    // SellerModule, // Not found
    // ThreePLModule, // Not found
    AuditModule,
    NotificationsModule,
    PreferencesModule,
    AdminOnboardingModule,
    OtpModule,
    NegotiationsModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
