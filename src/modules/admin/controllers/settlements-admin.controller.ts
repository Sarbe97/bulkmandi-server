import { Body, Controller, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CreateBatchDto } from 'src/modules/settlements/dto/create-batch.dto';
import { RunPayoutsDto } from 'src/modules/settlements/dto/run-payouts.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SettlementsAdminService } from '../services/settlement-admin.service';

@ApiTags('Admin Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/settlements')
export class SettlementsAdminController {
  constructor(private readonly settlementsAdminService: SettlementsAdminService) {}

  @Roles(UserRole.ADMIN)
  @Post('batches')
  async createBatch(@Body() dto: CreateBatchDto) {
    return this.settlementsAdminService.createBatch(dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('batches')
  async listBatches(@Query() query: any) {
    return this.settlementsAdminService.findBatches(query);
  }

  @Roles(UserRole.ADMIN)
  @Post('batches/:id/run-payouts')
  async runPayouts(@Param('id') id: string, @Body() dto: RunPayoutsDto) {
    return this.settlementsAdminService.runPayouts(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('process-queue')
  async processQueue(@Request() req: any) {
    return this.settlementsAdminService.processQueue(req.user.id);
  }

  @Roles(UserRole.ADMIN)
  @Post('orders/:id/force-release')
  async forceRelease(@Param('id') id: string, @Request() req: any) {
    return this.settlementsAdminService.forceRelease(id, req.user.id);
  }

  @Roles(UserRole.ADMIN)
  @Post('orders/:id/extend-buffer')
  async extendBuffer(@Param('id') id: string, @Body() body: { hours: number }, @Request() req: any) {
    return this.settlementsAdminService.extendBuffer(id, body.hours, req.user.id);
  }
}
