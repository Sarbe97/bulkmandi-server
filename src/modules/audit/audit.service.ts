import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
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
      timestamp: new Date(),
    };

    // Fire and forget — never block the caller
    this.auditLogModel
      .create(payload)
      .catch((err) =>
        this.logger.error(`Failed to persist audit log [${dto.action}]: ${err?.message}`, err?.stack),
      );
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
