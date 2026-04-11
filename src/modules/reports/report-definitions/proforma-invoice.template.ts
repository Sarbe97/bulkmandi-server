/**
 * ProformaInvoiceTemplate
 * ───────────────────────
 * Maps raw order and organization data into the context shape
 * expected by the proforma-invoice.hbs template.
 */

import { ReportTemplate } from '../interfaces/report-template.interface';
import * as fs from 'fs';
import * as path from 'path';

export class ProformaInvoiceTemplate implements ReportTemplate {
  readonly templateKey = 'proforma-invoice';
  readonly reportName = 'Proforma_Invoice';
  readonly templateFile = 'proforma-invoice.hbs';

  readonly pdfOptions = {
    format: 'A4' as const,
    landscape: false,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }, // Page uses its own internal padding
  };

  /**
   * Expected rawData structure:
   * {
   *   order: Order,
   *   seller: Organization,
   *   buyer: Organization
   * }
   */
  prepareContext(rawData: any): Record<string, any> {
    const o = rawData.order;
    const s = rawData.seller;
    const b = rawData.buyer;
    const now = new Date();

    // Load logo as base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'assets/bm-logo.png');
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
      }
    } catch (err) {
      // Fallback to empty string if logo read fails
    }

    return {
      logo: logoBase64,
      orderId: o.orderId,
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      orderDate: o.createdAt 
        ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A',
      currency: o.pricing?.currency || 'INR',
      
      // Seller details
      seller: {
        name: s.legalName || 'N/A',
        address: s.orgKyc?.registeredAddress || 'Registered Address Not Provided',
        gstin: s.orgKyc?.gstin || 'GST-PENDING',
      },

      // Buyer details
      buyer: {
        name: b.legalName || 'N/A',
        address: b.orgKyc?.registeredAddress || 'Delivery Address Not Provided',
        gstin: b.orgKyc?.gstin || 'GST-PENDING',
      },

      // Product details
      product: {
        category: o.product?.category || 'N/A',
        grade: o.product?.grade || 'N/A',
        specifications: o.product?.specifications || 'Standard',
        quantityMT: o.product?.quantityMT || 0,
      },

      // Pricing
      pricing: {
        pricePerMT: (o.pricing?.pricePerMT || 0).toLocaleString('en-IN'),
        baseAmount: (o.pricing?.baseAmount || 0).toLocaleString('en-IN'),
        freightTotal: (o.pricing?.freightTotal || 0).toLocaleString('en-IN'),
        platformFee: (o.pricing?.platformFee || 0).toLocaleString('en-IN'),
        taxableValue: (o.pricing?.baseAmount + o.pricing?.freightTotal + (o.pricing?.platformFee || 0)).toLocaleString('en-IN'),
        taxRate: o.pricing?.taxRate || 18,
        taxAmount: (o.pricing?.taxAmount || 0).toLocaleString('en-IN'),
        grandTotal: (o.pricing?.grandTotal || 0).toLocaleString('en-IN'),
      },


      // Logistics
      incoterm: o.incoterm || 'DAP',
      deliveryPin: o.deliveryPin || 'N/A',

      // Payment Terms
      paymentTerms: o.paymentTerms || 'Standard (80/20)',
      payoutRemark: (() => {
        const terms = o.paymentTerms;
        if (terms === '100% Escrow (Full Advance)') {
          return 'Escrow release to seller: 100% released immediately upon dispatch confirmation.';
        }
        if (terms === '50/50 Escrow (Advance/Loading)') {
          return 'Escrow release to seller: 50% mobilization advance on payment receipt, 50% on dispatch.';
        }
        // Default (80/20)
        return 'Escrow release to seller follows the 80/20 rule (80% on dispatch, 20% on delivery acceptance).';
      })(),

      // Escrow Details
      escrow: {
        beneficiaryName: rawData.escrowDetails?.beneficiaryName || 'N/A',
        bankName: rawData.escrowDetails?.bankName || 'N/A',
        accountNumber: rawData.escrowDetails?.accountNumber || 'N/A',
        ifscCode: rawData.escrowDetails?.ifscCode || 'N/A',
        branchName: rawData.escrowDetails?.branchName || 'N/A',
      }
    };
  }
}
