import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('Admin — Activity Log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated activity log (admin only)' })
  @ApiQuery({ name: 'module', required: false, description: 'Business domain: AUTH|RFQ|QUOTE|ORDER|SHIPMENT|KYC|PAYMENT|SETTLEMENT|ORG' })
  @ApiQuery({ name: 'action', required: false, description: 'e.g. RFQ_CREATED, KYC_APPROVED' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false, description: 'MongoDB ObjectId or business ID like RFQ-xxx' })
  @ApiQuery({ name: 'actorId', required: false, description: 'User ObjectId' })
  @ApiQuery({ name: 'severity', required: false, enum: ['INFO', 'WARNING', 'ERROR'] })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string (e.g. 2026-01-01)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string (e.g. 2026-12-31)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  async getActivityLog(@Query() query: QueryAuditLogDto) {
    return this.auditService.query({
      ...query,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    });
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available filter options (modules & actions) for dropdowns' })
  async getFilterOptions() {
    return this.auditService.getFilterOptions();
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get all audit logs for a specific entity (e.g., a single RFQ, Order, etc.)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getEntityLog(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.auditService.getByEntity(entityType, entityId, Number(page), Number(limit));
  }

  @Get('actor/:actorId')
  @ApiOperation({ summary: 'Get all audit logs for a specific user (actor)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getActorLog(
    @Param('actorId') actorId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.auditService.getByActor(actorId, Number(page), Number(limit));
  }
}
