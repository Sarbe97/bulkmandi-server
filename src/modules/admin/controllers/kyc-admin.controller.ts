import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { KycAdminService } from 'src/modules/kyc/kyc-admin.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('Admin KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/kyc')
export class KycAdminController {
  constructor(private readonly kycAdminService: KycAdminService) {}

  // List all KYC cases with status 'SUBMITTED'
  @Roles(UserRole.ADMIN)
  @Get('pending')
  async getPendingKycCases() {
    return this.kycAdminService.getPendingKycSubmissions();
  }

  // Get a specific KYC case and its org snapshot by ID
  @Roles(UserRole.ADMIN)
  @Get('case/:kycCaseId')
  async getKycCaseById(@Param('kycCaseId') kycCaseId: string) {
    return this.kycAdminService.getKycCaseById(kycCaseId);
  }

  // Approve KYC
  @Roles(UserRole.ADMIN)
  @Post('case/:kycCaseId/approve')
  async approveKyc(
    @Param('kycCaseId') kycCaseId: string,
    @Body('adminId') adminId: string, // Or get from CurrentUser
    @Body('remarks') remarks?: string,
  ) {
    return this.kycAdminService.approveKycSubmission(kycCaseId, adminId, remarks);
  }

  // Reject KYC
  @Roles(UserRole.ADMIN)
  @Post('case/:kycCaseId/reject')
  async rejectKyc(
    @Param('kycCaseId') kycCaseId: string,
    @Body('adminId') adminId: string, // Or get from CurrentUser
    @Body('rejectionReason') rejectionReason: string,
  ) {
    return this.kycAdminService.rejectKycSubmission(kycCaseId, adminId, rejectionReason);
  }

  // Get submission history for one org
  @Roles(UserRole.ADMIN)
  @Get('org/:orgId/history')
  async getKycHistory(@Param('orgId') orgId: string) {
    return this.kycAdminService.getKycCaseHistory(orgId);
  }
}
