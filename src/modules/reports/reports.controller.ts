/**
 * ReportsController
 * ──────────────────
 * API endpoints for downloading PDF reports.
 * All endpoints are protected by JWT auth.
 * Access is role-agnostic — any authenticated user can download
 * reports they are authorised for (validation in the service layer).
 */

import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly logger: CustomLoggerService,
  ) {}

  // ════════════════════════════════════════════════════════════
  //  SHIPMENT MANIFEST — Download
  // ════════════════════════════════════════════════════════════
  @ApiOperation({ summary: 'Download shipment manifest PDF' })
  @ApiProduces('application/pdf')
  @Get('shipment-manifest/:shipmentId')
  async downloadShipmentManifest(
    @Param('shipmentId') shipmentId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(`Manifest download requested for shipment: ${shipmentId}`);

      const { buffer, filename } = await this.reportsService.generateShipmentManifest(shipmentId);

      // Set response headers for PDF download
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store',
      });

      res.end(buffer);
    } catch (err: any) {
      this.logger.error(`Failed to generate manifest: ${err.message}`, err.stack);

      if (err.status) {
        // Re-throw NestJS HTTP exceptions (NotFoundException, etc.)
        throw err;
      }

      throw new InternalServerErrorException('Failed to generate shipment manifest');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  PROFORMA INVOICE — Download
  // ════════════════════════════════════════════════════════════
  @ApiOperation({ summary: 'Download Proforma Invoice PDF' })
  @ApiProduces('application/pdf')
  @Get('proforma-invoice/:orderId')
  async downloadProformaInvoice(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(`Proforma download requested for order: ${orderId}`);

      const { buffer, filename } = await this.reportsService.generateProformaInvoice(orderId);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store',
      });

      res.end(buffer);
    } catch (err: any) {
      this.logger.error(`Failed to generate Proforma: ${err.message}`);
      if (err.status) throw err;
      throw new InternalServerErrorException('Failed to generate Proforma Invoice');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  FUTURE ENDPOINTS GO HERE
  // ════════════════════════════════════════════════════════════
  //
  // @Get('settlement-report/:id')
  // async downloadSettlementReport(...) { ... }
}
