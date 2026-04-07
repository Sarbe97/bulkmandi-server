export class QueryAuditLogDto {
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR';
  /** ISO date string — start of range */
  from?: string;
  /** ISO date string — end of range */
  to?: string;
  page?: number;
  limit?: number;
  targetUserId?: string;
  targetOrgId?: string;
}
