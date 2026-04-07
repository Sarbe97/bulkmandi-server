/**
 * Application Constants
 * Centralized constants for validation, business rules, and configuration
 * Synced with frontend: bulkmandi-web/src/shared/constants/app.constants.ts
 */

// ========== RE-EXPORT EXISTING ENUMS ==========
export { UserRole, RfqStatus, QuoteStatus, OrderStatus, DocumentType } from '../enums';
export { KYCStatus } from '../../modules/kyc/kyc-status.constants';

// ========== ACCOUNT & BANKING ==========

export enum AccountType {
    SAVINGS = 'SAVINGS',
    CURRENT = 'CURRENT',
    OVERDRAFT = 'OVERDRAFT', // Changed from 'OD' for consistency
}

export enum PennyDropStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    FAILED = 'FAILED',
}

export enum PaymentMethod {
    UPI = 'UPI',
    RTGS = 'RTGS',
    NEFT = 'NEFT',
    NETBANKING = 'NETBANKING',
}

// ========== TRADE & LOGISTICS ==========

export enum Incoterms {
    DAP = 'DAP',
    EXW = 'EXW',
    FCA = 'FCA',
    CPT = 'CPT',
    CIP = 'CIP',
    DDP = 'DDP',
    FOB = 'FOB',
    CIF = 'CIF',
}

export enum AcceptanceWindow {
    FAST = '24h',
    NORMAL = '48h',
    EXTENDED = '72h',
}

export enum QCRequirement {
    VISUAL_WEIGHT = 'VISUAL_WEIGHT',
    LAB_REQUIRED = 'LAB_REQUIRED',
}

// ========== 3PL / FLEET ==========

export enum EwayBillIntegration {
    API = 'api',
    MANUAL = 'manual',
}

export enum LogisticsPreference {
    PLATFORM_3PL = 'PLATFORM_3PL',
    SELF_PICKUP = 'SELF_PICKUP',
    SELLER_MANAGED = 'SELLER_MANAGED',
}

export const POD_METHODS = {
    DRIVER_APP: 'driver_app',
    PDF: 'pdf',
} as const;

export type PodMethod = typeof POD_METHODS[keyof typeof POD_METHODS];

// Note: FLEET_TYPES and STEEL_CATEGORIES removed - these are now managed in database via master-data module

// ========== AUDIT & LOGGING ==========

export enum AuditModule {
    AUTH = 'AUTH',
    RFQ = 'RFQ',
    QUOTE = 'QUOTE',
    ORDER = 'ORDER',
    SHIPMENT = 'SHIPMENT',
    KYC = 'KYC',
    PAYMENT = 'PAYMENT',
    SETTLEMENT = 'SETTLEMENT',
    NEGOTIATION = 'NEGOTIATION',
    ORG = 'ORG',
    MASTER_DATA = 'MASTER_DATA',
}

export enum AuditEntityType {
    USER = 'USER',
    ORGANIZATION = 'ORGANIZATION',
    RFQ = 'RFQ',
    QUOTE = 'QUOTE',
    ORDER = 'ORDER',
    SHIPMENT = 'SHIPMENT',
    SHIPMENT_RFQ = 'SHIPMENT_RFQ',
    SHIPMENT_BID = 'SHIPMENT_BID',
    PAYMENT = 'PAYMENT',
    SETTLEMENT = 'SETTLEMENT',
    NEGOTIATION = 'NEGOTIATION',
    KYC = 'KYC',
}

export enum AuditAction {
    // Auth
    USER_LOGIN = 'USER_LOGIN',
    USER_REGISTER = 'USER_REGISTER',
    LOGIN_FAILED = 'LOGIN_FAILED',
    
    // RFQ
    RFQ_CREATED = 'RFQ_CREATED',
    RFQ_PUBLISHED = 'RFQ_PUBLISHED',
    RFQ_UPDATED = 'RFQ_UPDATED',
    RFQ_CLOSED = 'RFQ_CLOSED',
    RFQ_DELETED = 'RFQ_DELETED',
    
    // Quote
    QUOTE_SUBMITTED = 'QUOTE_SUBMITTED',
    QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
    QUOTE_UPDATED = 'QUOTE_UPDATED',
    QUOTE_WITHDRAWN = 'QUOTE_WITHDRAWN',
    
    // Order
    ORDER_CREATED = 'ORDER_CREATED',
    ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
    ORDER_CANCELLED = 'ORDER_CANCELLED',
    ORDER_PI_CONFIRMED = 'ORDER_PI_CONFIRMED',
    DELIVERY_ACCEPTED = 'DELIVERY_ACCEPTED',
    DELIVERY_DISPUTED = 'DELIVERY_DISPUTED',
    
    // Shipment
    SHIPMENT_CREATED = 'SHIPMENT_CREATED',
    SHIPMENT_STATUS_CHANGED = 'SHIPMENT_STATUS_CHANGED',
    SHIPMENT_DISPATCHED = 'SHIPMENT_DISPATCHED',
    SHIPMENT_DELIVERED = 'SHIPMENT_DELIVERED',
    MILESTONE_ADDED = 'MILESTONE_ADDED',
    POD_UPLOADED = 'POD_UPLOADED',
    DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
    DOCUMENT_DELETED = 'DOCUMENT_DELETED',
    SHIPMENT_RFQ_CREATED = 'SHIPMENT_RFQ_CREATED',
    SHIPMENT_BID_SUBMITTED = 'SHIPMENT_BID_SUBMITTED',
    SHIPMENT_AWARDED = 'SHIPMENT_AWARDED',
    
    // Payment & Settlement
    PAYMENT_ESCROW_INITIATED = 'PAYMENT_ESCROW_INITIATED',
    PAYMENT_VERIFIED_BY_ADMIN = 'PAYMENT_VERIFIED_BY_ADMIN',
    PAYMENT_REJECTED_BY_ADMIN = 'PAYMENT_REJECTED_BY_ADMIN',
    ESCROW_STAGE1_RELEASED = 'ESCROW_STAGE1_RELEASED',
    ESCROW_STAGE2_RELEASED = 'ESCROW_STAGE2_RELEASED',
    ESCROW_STAGE2_HELD = 'ESCROW_STAGE2_HELD',
    SETTLEMENT_CREATED = 'SETTLEMENT_CREATED',
    SETTLEMENT_PAID = 'SETTLEMENT_PAID',
    SETTLEMENT_TIMER_STARTED = 'SETTLEMENT_TIMER_STARTED',
    SETTLEMENT_TIMER_EXTENDED = 'SETTLEMENT_TIMER_EXTENDED',
    
    // Negotiation
    NEGOTIATION_INITIATED = 'NEGOTIATION_INITIATED',
    NEGOTIATION_COUNTER = 'NEGOTIATION_COUNTER',
    NEGOTIATION_ACCEPTED = 'NEGOTIATION_ACCEPTED',
    NEGOTIATION_REJECTED = 'NEGOTIATION_REJECTED',
    
    // KYC
    KYC_APPROVED = 'KYC_APPROVED',
    KYC_REJECTED = 'KYC_REJECTED',
    KYC_INFO_REQUESTED = 'KYC_INFO_REQUESTED',
    KYC_WATCHLISTED = 'KYC_WATCHLISTED',
    KYC_UNLOCKED = 'KYC_UNLOCKED',
}

// ========== VALIDATION LIMITS ==========

export const VALIDATION_LIMITS = {
    PENNY_DROP_SCORE: {
        MIN: 0,
        MAX: 100,
    },
    QUANTITY: {
        MIN: 0,
    },
    LEAD_TIME_DAYS: {
        MIN: 1,
        MAX: 365,
    },
    PRICE: {
        MIN: 0,
    },
} as const;

// ========== HELPER ARRAYS FOR @IsEnum ==========

export const INCOTERMS_VALUES = Object.values(Incoterms);
export const ACCOUNT_TYPE_VALUES = Object.values(AccountType);
export const PENNY_DROP_STATUS_VALUES = Object.values(PennyDropStatus);
export const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod);
export const ACCEPTANCE_WINDOW_VALUES = Object.values(AcceptanceWindow);
export const QC_REQUIREMENT_VALUES = Object.values(QCRequirement);
export const EWAY_BILL_INTEGRATION_VALUES = Object.values(EwayBillIntegration);
export const POD_METHOD_VALUES = Object.values(POD_METHODS);
