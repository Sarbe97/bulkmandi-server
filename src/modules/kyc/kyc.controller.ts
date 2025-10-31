import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycAdminService } from './services/kyc-admin.service';

@ApiTags('Admin KYC Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/kyc')
export class KycController {
  constructor(private readonly kycAdminService: KycAdminService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get KYC verification queue' })
  @ApiQuery({ name: 'status', required: false, enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'] })
  @ApiQuery({ name: 'role', required: false, enum: ['SELLER', 'BUYER', '3PL'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by organization name' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getQueue(@Query() filters: {
    status?: string;
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.kycAdminService.getKycQueue(filters);
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get detailed KYC case information' })
  @ApiParam({ name: 'caseId', description: 'KYC Case ID' })
  async getCaseDetail(@Param('caseId') caseId: string) {
    return this.kycAdminService.getKycCaseDetail(caseId);
  }

  @Post('case/:caseId/approve')
  @ApiOperation({ summary: 'Approve KYC case' })
  @ApiParam({ name: 'caseId', description: 'KYC Case ID' })
  async approveCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: any,
    @Body() body: { remarks?: string },
  ) {
    return this.kycAdminService.approveKycCase(caseId, user.userId, body.remarks);
  }

  @Post('case/:caseId/reject')
  @ApiOperation({ summary: 'Reject KYC case' })
  @ApiParam({ name: 'caseId', description: 'KYC Case ID' })
  async rejectCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: any,
    @Body() body: { rejectionReason: string },
  ) {
    return this.kycAdminService.rejectKycCase(caseId, user.userId, body.rejectionReason);
  }

  @Post('case/:caseId/request-info')
  @ApiOperation({ summary: 'Request more information from seller' })
  @ApiParam({ name: 'caseId', description: 'KYC Case ID' })
  async requestMoreInfo(
    @Param('caseId') caseId: string,
    @CurrentUser() user: any,
    @Body() body: { message: string; fields: string[] },
  ) {
    return this.kycAdminService.requestMoreInfo(caseId, user.userId, body.message, body.fields);
  }

  @Post('case/:caseId/watchlist')
  @ApiOperation({ summary: 'Add organization to watchlist' })
  @ApiParam({ name: 'caseId', description: 'KYC Case ID' })
  async addToWatchlist(
    @Param('caseId') caseId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string; tags: string[] },
  ) {
    return this.kycAdminService.addToWatchlist(caseId, user.userId, body.reason, body.tags);
  }

  @Get('history/:orgId')
  @ApiOperation({ summary: 'Get KYC case history for organization' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  async getCaseHistory(@Param('orgId') orgId: string) {
    return this.kycAdminService.getKycCaseHistory(orgId);
  }
}
