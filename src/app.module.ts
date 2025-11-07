import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

// Keep Auth (existing)
import { AuthModule } from "./modules/auth/auth.module";

// New modules
import { CoreModule } from "./core/core.module";
import { DatabaseModule } from "./core/database/database.module";
import { ThreePLModule } from "./modules/3pl/3pl.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BuyerModule } from "./modules/buyer/buyer.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { DisputesModule } from "./modules/disputes/disputes.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { RfqModule } from "./modules/rfq/rfq.module";
import { SellerModule } from "./modules/seller/seller.module";
import { SettlementsModule } from "./modules/settlements/settlements.module";
import { ShipmentsModule } from "./modules/shipments/shipments.module";

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
    CatalogModule,
    RfqModule,
    QuotesModule,
    OrdersModule,
    PaymentsModule,
    ShipmentsModule,
    DisputesModule,
    SettlementsModule,
    BuyerModule,
    SellerModule,
    AdminModule,
    ThreePLModule,
    AuditModule,
    NotificationsModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
