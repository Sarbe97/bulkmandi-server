export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
  LOGISTIC = 'LOGISTIC',
  '3PL' = '3PL',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

// ❌ REMOVED: Duplicate KycStatus enum - Use KYCStatus from modules/kyc/kyc-status.constants.ts instead

export enum RfqStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  WON = 'WON', // ✅ Renamed from AWARDED to match frontend and service logic
  EXPIRED = 'EXPIRED',
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum OrderStatus {
  PI_ISSUED = 'PI_ISSUED',
  CONFIRMED = 'CONFIRMED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  PAID = 'PAID',
  DISPATCH_PREP = 'DISPATCH_PREP',
  LOGISTICS_AWARDED = 'LOGISTICS_AWARDED',   // ✅ Admin has awarded, waiting for carrier
  LOGISTICS_ACCEPTED = 'LOGISTICS_ACCEPTED', // ✅ Carrier has accepted, ready for dispatch
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ShipmentRfqStatus {
  OPEN = 'OPEN',
  AWARDED = 'AWARDED', // Awaiting carrier acceptance
  ASSIGNED = 'ASSIGNED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}


export enum DocumentType {
  GST_CERTIFICATE = 'GST_CERTIFICATE',
  PAN_CERTIFICATE = 'PAN_CERTIFICATE',
  CANCELLED_CHEQUE = 'CANCELLED_CHEQUE',
  BANK_LETTER = 'BANK_LETTER',                 // ✅ Added
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',       // ✅ Added
  FACTORY_LICENSE = 'FACTORY_LICENSE',
  INCORPORATION_CERT = 'INCORPORATION_CERT',   // ✅ Added
  QA_CERTIFICATE = 'QA_CERTIFICATE',           // ✅ Added
  COMPANY_PAN = 'COMPANY_PAN',                 // ✅ Added
}
