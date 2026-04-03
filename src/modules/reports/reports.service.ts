/**
 * ReportsService
 * ───────────────
 * Orchestration layer — fetches raw data from domain services
 * and passes it to PdfGeneratorService. The template's
 * prepareContext() handles all data transformation.
 *
 * Each public method corresponds to one report type.
 * Adding a new report = add one method here + one template + one .hbs file.
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { OrdersService } from '../orders/orders.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { MasterDataService } from '../master-data/master-data.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    @Inject(forwardRef(() => ShipmentsService)) private readonly shipmentsService: ShipmentsService,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    private readonly orgsService: OrganizationsService,
    private readonly masterDataService: MasterDataService,
    private readonly logger: CustomLoggerService,
  ) {}

  // ════════════════════════════════════════════════════════════
  //  SHIPMENT MANIFEST
  // ════════════════════════════════════════════════════════════

  /**
   * Generate a shipment manifest PDF.
   *
   * @param shipmentId - MongoDB _id of the shipment
   * @returns PDF buffer + suggested filename
   */
  async generateShipmentManifest(shipmentId: string): Promise<{ buffer: Buffer; filename: string }> {
    this.logger.log(`Generating shipment manifest for: ${shipmentId}`);

    // 1. Fetch shipment
    const shipment = await this.shipmentsService.findByIdOrFail(shipmentId);

    // 2. Resolve org names (they may not be stored directly on the shipment)
    let sellerOrgName = 'N/A';
    let buyerOrgName = 'N/A';

    try {
      const sellerOrg = await this.orgsService.getOrganization(shipment.sellerId.toString());
      sellerOrgName = sellerOrg?.legalName || 'N/A';
    } catch { /* non-critical */ }

    try {
      const buyerOrg = await this.orgsService.getOrganization(shipment.buyerId.toString());
      buyerOrgName = buyerOrg?.legalName || 'N/A';
    } catch { /* non-critical */ }

    // 3. Build raw data object — the template's prepareContext() handles mapping
    const rawData = {
      shipment: {
        ...shipment.toObject(),
        sellerOrgName,
        buyerOrgName,
      },
    };

    // 4. Generate PDF
    const buffer = await this.pdfGenerator.generate('shipment-manifest', rawData);

    const filename = `Manifest_${shipment.shipmentId}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return { buffer, filename };
  }

  // ════════════════════════════════════════════════════════════
  //  PROFORMA INVOICE
  // ════════════════════════════════════════════════════════════

  /**
   * Generate a Proforma Invoice PDF.
   *
   * @param orderId - MongoDB _id of the order
   */
  async generateProformaInvoice(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    this.logger.log(`Generating Proforma Invoice for order: ${orderId}`);

    // 1. Fetch order
    const order = await this.ordersService.findByOrderIdOrFail(orderId);

    // 2. Fetch parties
    const seller = await this.orgsService.getOrganization(order.sellerId.toString());
    const buyer = await this.orgsService.getOrganization(order.buyerId.toString());

    // 3. Fetch Escrow Details
    const escrowDetails = await this.masterDataService.getEscrowAccount();
    
    // 4. Generate PDF
    const rawData = { order, seller, buyer, escrowDetails };
    const buffer = await this.pdfGenerator.generate('proforma-invoice', rawData);

    const filename = `Proforma_${order.orderId}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return { buffer, filename };
  }

  // ════════════════════════════════════════════════════════════
  //  FUTURE REPORT METHODS GO HERE
  // ════════════════════════════════════════════════════════════
  //
  // async generateSettlementReport(filters: any): Promise<{ buffer: Buffer; filename: string }> { ... }
}
