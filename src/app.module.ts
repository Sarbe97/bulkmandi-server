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
    // CatalogModule,

    // OrdersModule,
    // PaymentsModule,
    // ShipmentsModule,
    // DisputesModule,
    // SettlementsModule,
    // BuyerModule,
    // SellerModule,

    // ThreePLModule,
    // AuditModule,
    // NotificationsModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
