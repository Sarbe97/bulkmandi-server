import { OrganizationsService } from '@modules/organizations/organizations.service';
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService,
    private readonly orgService: OrganizationsService
  ) { }

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Post('organizations/:orgCode/create-invite-code')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create invite code for organization (ADMIN ONLY)' })
  @ApiParam({ name: 'orgCode', description: 'Organization code' })
  async createInviteCode(
    @Param('orgCode') orgCode: string,
    @Body() body: { expiryDays?: number },
  ) {
    return this.orgService.createInviteCode(orgCode, body.expiryDays || 7);
  }

  @Delete('organizations/:orgCode/revoke-invite-code')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Revoke invite code (ADMIN ONLY)' })
  async revokeInviteCode(@Param('orgCode') orgCode: string) {
    return this.orgService.revokeInviteCode(orgCode);
  }

  @Post('organizations/validate-invite-code')
  @ApiOperation({ summary: 'Validate an invite code (public)' })
  async validateCode(@Body() body: { inviteCode: string }) {
    return this.orgService.validateInviteCode(body.inviteCode);
  }
}
