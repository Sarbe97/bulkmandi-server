import { Types } from 'mongoose';

export class CreateAuditLogDto {
  actorId?: string | Types.ObjectId;
  actorType?: 'USER' | 'SYSTEM' | 'SERVICE';

  /** e.g. RFQ_CREATED, KYC_APPROVED, USER_LOGIN */
  action!: string;

  /** Business domain: AUTH | RFQ | QUOTE | ORDER | SHIPMENT | KYC | PAYMENT | SETTLEMENT | ORG */
  module!: string;

  /** Collection/entity type: RFQ | ORDER | SHIPMENT | KYC_CASE | PAYMENT | QUOTE | USER | ORG */
  entityType!: string;

  entityId?: string | Types.ObjectId;
  entityIdStr?: string;

  /** Only the changed fields (not the full document) */
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changedFields?: string[];

  userIp?: string;
  description?: string;

  /** INFO | WARNING | ERROR — defaults to INFO */
  severity?: 'INFO' | 'WARNING' | 'ERROR';
}
