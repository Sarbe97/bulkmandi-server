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

export const POD_METHODS = {
    DRIVER_APP: 'driver_app',
    PDF: 'pdf',
} as const;

export type PodMethod = typeof POD_METHODS[keyof typeof POD_METHODS];

// Note: FLEET_TYPES and STEEL_CATEGORIES removed - these are now managed in database via master-data module

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
