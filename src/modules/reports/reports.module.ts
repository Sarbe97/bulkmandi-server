/**
 * ReportsModule
 * ──────────────
 * Self-contained module for PDF report generation.
 * Imports domain modules to access data services.
 */

import { Module, forwardRef } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { OrdersModule } from '../orders/orders.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [
    forwardRef(() => ShipmentsModule),
    forwardRef(() => OrdersModule),
    OrganizationsModule,
    MasterDataModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfGeneratorService],
  exports: [ReportsService, PdfGeneratorService],
})
export class ReportsModule {}
