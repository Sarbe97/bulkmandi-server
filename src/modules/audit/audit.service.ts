import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditAction } from 'src/common/constants/app.constants';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Fire-and-forget audit log. Call this WITHOUT await in your service methods
   * so auditing never blocks the primary operation.
   *
   * Example:
   *   this.auditService.log({ action: 'RFQ_CREATED', module: 'RFQ', ... });
   */
  log(dto: CreateAuditLogDto): void {
    const logId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const payload: Partial<AuditLog> = {
      logId,
      actorId: dto.actorId ? new Types.ObjectId(dto.actorId.toString()) : undefined,
      actorType: dto.actorType ?? 'USER',
      action: dto.action,
      module: dto.module,
      entityType: dto.entityType,
      entityId: dto.entityId ? new Types.ObjectId(dto.entityId.toString()) : undefined,
      entityIdStr: dto.entityIdStr,
      beforeState: dto.beforeState,
      afterState: dto.afterState,
      changedFields: dto.changedFields ?? [],
      userIp: dto.userIp,
      description: dto.description,
      severity: dto.severity ?? 'INFO',
      targetUserIds: dto.targetUserIds?.map(id => new Types.ObjectId(id.toString())),
      targetOrgIds: dto.targetOrgIds?.map(id => new Types.ObjectId(id.toString())),
      timestamp: new Date(),
    };

    // Fire and forget — never block the caller
    this.auditLogModel
      .create(payload)
      .then(async (log) => {
        // DERIVE NOTIFICATIONS
        await this.deriveNotifications(log as AuditLogDocument);
      })
      .catch((err) =>
        this.logger.error(`Failed to persist audit log [${dto.action}]: ${err?.message}`, err?.stack),
      );
  }

  /**
   * Automatically triggers in-app notifications for specific audit actions.
   */
  private async deriveNotifications(log: AuditLog) {
    if (!log.targetUserIds || log.targetUserIds.length === 0) return;

    const action = log.action as AuditAction;
    let title = '';
    let message = '';
    let category = log.module;

    console.log(`[Audit Engine] Deriving notification for action: ${action} | 대상: ${log.targetUserIds.length} users`);

    switch (action) {
      case AuditAction.QUOTE_SUBMITTED:
        title = 'New Quote Received';
        message = `A seller has submitted a quote for your RFQ #${log.afterState?.rfqId || 'N/A'}`;
        break;

      case AuditAction.ORDER_CREATED:
        title = '📄 Proforma Invoice Issued';
        message = `A Proforma Invoice has been issued for your order ${log.entityIdStr}. Please review and confirm to proceed.`;
        break;

      case AuditAction.ORDER_PI_CONFIRMED:
        title = 'Order Confirmed';
        message = `Buyer confirmed PI for Order #${log.entityIdStr}. Ready for processing.`;
        break;

      case AuditAction.PAYMENT_VERIFIED_BY_ADMIN:
        title = 'Payment Verified';
        message = `Payment for Order #${log.afterState?.orderId || 'N/A'} was verified by the admin.`;
        break;

      case AuditAction.SHIPMENT_DISPATCHED:
        title = 'Shipment Dispatched';
        message = `Your order #${log.afterState?.orderId || 'N/A'} has been dispatched.`;
        break;

      case AuditAction.SHIPMENT_DELIVERED:
        title = 'Shipment Delivered';
        message = `Your order #${log.afterState?.orderId || 'N/A'} was delivered successfully.`;
        break;

      case AuditAction.DELIVERY_ACCEPTED:
        title = '🏁 Delivery Accepted';
        message = `Buyer has accepted the delivery for Order ${log.entityIdStr}. Settlement is in progress.`;
        break;

      case AuditAction.DELIVERY_DISPUTED:
        title = '⚠️ Order Disputed';
        message = `A dispute has been raised for Order ${log.entityIdStr}. Settlement has been paused.`;
        break;

      case AuditAction.KYC_APPROVED:
        title = 'KYC Verified';
        message = 'Your organization KYC has been approved. You can now start trading.';
        break;

      case AuditAction.KYC_REJECTED:
        title = 'KYC Rejected';
        message = 'Your organization KYC was rejected. Please review and resubmit.';
        break;

      case AuditAction.NEGOTIATION_COUNTER:
        title = 'New Counter Offer';
        message = `A counter-offer was made for Quote #${log.afterState?.quoteId || 'N/A'}`;
        break;

      case AuditAction.RFQ_PUBLISHED:
      case AuditAction.RFQ_CREATED:
        // Only notify if status is OPEN (published)
        if (log.afterState?.status === 'OPEN') {
           title = '🎯 New RFQ Published';
           message = `A new RFQ for ${log.afterState?.category || 'Material'} is now open for bidding (#${log.entityIdStr})`;
        } else {
           return;
        }
        break;

      default:
        return;
    }

    if (!title || !message) {
      console.log(`[Audit Engine] Skipping notification for ${action}: Title or Message is missing.`);
      return;
    }

    // Trigger notification for each target user
    this.logger.log(`[deriveNotifications] Broadcasting "${title}" to ${log.targetUserIds.length} users`);
    for (const userId of log.targetUserIds) {
      this.notificationsService.notify(userId.toString(), title, message, {
        category,
        data: {
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          entityIdStr: log.entityIdStr,
        }
      });
    }
  }

  /**
   * Paginated query for the admin Activity Log page.
   */
  async query(dto: QueryAuditLogDto = {}) {
    const filter: Record<string, any> = {};
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 50));

    if (dto.module) filter.module = dto.module;
    if (dto.action) filter.action = dto.action;
    if (dto.entityType) filter.entityType = dto.entityType;
    if (dto.severity) filter.severity = dto.severity;

    if (dto.actorId && Types.ObjectId.isValid(dto.actorId)) {
      filter.actorId = new Types.ObjectId(dto.actorId);
    }
    if (dto.entityId && Types.ObjectId.isValid(dto.entityId)) {
      filter.entityId = new Types.ObjectId(dto.entityId);
    } else if (dto.entityId) {
      // Try matching by string ID (e.g. RFQ-xxx, ORD-xxx)
      filter.entityIdStr = dto.entityId;
    }

    if (dto.from || dto.to) {
      filter.timestamp = {};
      if (dto.from) filter.timestamp.$gte = new Date(dto.from);
      if (dto.to) filter.timestamp.$lte = new Date(dto.to);
    }

    // Participant-based activity feed support (OR logic)
    // If both targetUserId and targetOrgId are provided, query for (targetUserIds OR targetOrgIds OR actorId)
    // to ensure user sees everything involving them, their org, or they did personally.
    if (dto.targetUserId || dto.targetOrgId) {
      const orConditions: any[] = [];
      if (dto.targetUserId && Types.ObjectId.isValid(dto.targetUserId)) {
        orConditions.push({ targetUserIds: new Types.ObjectId(dto.targetUserId) });
        orConditions.push({ actorId: new Types.ObjectId(dto.targetUserId) });
      }
      if (dto.targetOrgId && Types.ObjectId.isValid(dto.targetOrgId)) {
        orConditions.push({ targetOrgIds: new Types.ObjectId(dto.targetOrgId) });
      }
      
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }
    }

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetch all audit logs for a specific entity (e.g., all logs for Order ORD-xxx).
   */
  async getByEntity(entityType: string, entityId: string, page = 1, limit = 50) {
    const filter: Record<string, any> = { entityType };

    if (Types.ObjectId.isValid(entityId)) {
      filter.entityId = new Types.ObjectId(entityId);
    } else {
      filter.entityIdStr = entityId;
    }

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((Math.max(1, page) - 1) * limit)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Fetch all audit logs performed by a specific user (actor).
   */
  async getByActor(actorId: string, page = 1, limit = 50) {
    if (!Types.ObjectId.isValid(actorId)) {
      return { data: [], total: 0, page, limit };
    }

    const filter = { actorId: new Types.ObjectId(actorId) };

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((Math.max(1, page) - 1) * limit)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get distinct modules and actions — for populating filter dropdowns in the UI.
   */
  async getFilterOptions() {
    const [modules, actions] = await Promise.all([
      this.auditLogModel.distinct('module'),
      this.auditLogModel.distinct('action'),
    ]);
    return { modules, actions };
  }
}
