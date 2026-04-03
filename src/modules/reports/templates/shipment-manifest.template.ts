/**
 * ShipmentManifestTemplate
 * ─────────────────────────
 * Maps raw shipment data from the DB into the context shape
 * expected by the shipment-manifest.hbs Handlebars template.
 *
 * This file contains NO rendering logic — all layout and styling
 * lives in the .hbs template file.
 */

import { ReportTemplate } from '../interfaces/report-template.interface';

export class ShipmentManifestTemplate implements ReportTemplate {
  readonly templateKey = 'shipment-manifest';
  readonly reportName = 'Shipment_Manifest';
  readonly templateFile = 'shipment-manifest.hbs';

  readonly pdfOptions = {
    format: 'A4' as const,
    landscape: false,
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  };

  /**
   * Transform raw domain data into template-friendly context.
   * The keys returned here map directly to {{variables}} in the .hbs file.
   */
  prepareContext(rawData: any): Record<string, any> {
    const s = rawData.shipment;
    const now = new Date();

    return {
      // Header
      generatedDate: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      generatedTime: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),

      // Shipment info
      shipmentId: s.shipmentId,
      orderId: s.orderId?.toString?.() || String(s.orderId),
      status: (s.status || '').replace(/_/g, ' '),
      createdAt: s.createdAt
        ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A',

      // Parties
      sellerOrgName: s.sellerOrgName || 'N/A',
      buyerOrgName: s.buyerOrgName || 'N/A',

      // Product
      product: {
        category: s.product?.category || 'N/A',
        grade: s.product?.grade || 'Standard',
        quantityMT: s.product?.quantityMT?.toFixed(2) || '0.00',
      },

      // Vehicle
      vehicle: {
        vehicleNumber: s.vehicle?.vehicleNumber || 'Allocation Pending',
        vehicleType: s.vehicle?.vehicleType || 'Heavy Commercial',
        driverName: s.vehicle?.driverName || 'Not Assigned',
        driverMobile: s.vehicle?.driverMobile || 'N/A',
      },

      // Route
      pickup: {
        location: s.pickup?.location || 'N/A',
        pin: s.pickup?.pin,
      },
      delivery: {
        fullAddress: [s.delivery?.location, s.delivery?.city, s.delivery?.state, s.delivery?.pin ? 'PIN ' + s.delivery.pin : '']
          .filter(Boolean)
          .join(', ') || 'N/A',
      },

      // Status timeline
      statusTimeline: (s.statusTimeline || []).map((step: any, idx: number) => {
        const ts = new Date(step.timestamp);
        return {
          index: idx + 1,
          status: (step.status || '').replace(/_/g, ' '),
          timestamp: `${ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        };
      }),

      // Documents
      documents: (s.documents || []).map((d: any, idx: number) => ({
        index: idx + 1,
        docType: (d.docType || '').replace(/_/g, ' '),
        uploadedAt: d.uploadedAt
          ? new Date(d.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A',
        verified: !!d.verified,
      })),
    };
  }
}
