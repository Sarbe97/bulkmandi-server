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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,

    // Keep existing
    AuthModule,
    CoreModule,
    // Add all new modules
    OrganizationsModule,
    KycModule,
    // CatalogModule,
    // RfqModule,
    // QuotesModule,
    // OrdersModule,
    // PaymentsModule,
    // ShipmentsModule,
    // DisputesModule,
    // SettlementsModule,
    // BuyerModule,
    // SellerModule,
    UserOnboardingModule,
    AdminModule,
    // ThreePLModule,
    // AuditModule,
    // NotificationsModule,
    DocumentsModule,
    MasterDataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
