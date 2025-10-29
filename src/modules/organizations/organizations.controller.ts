import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycAdminService } from '../kyc/kyc-admin.service';
import { OrganizationsService } from './organizations.service';
 
@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly kycAdminService: KycAdminService,
  ) {}

  @Put('my-organization/onboarding/kyc')
  async updateOrgKyc(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateOrgKyc(user.organizationId, body);
  }

  @Put('my-organization/onboarding/bank')
  async updateBankDetails(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateBankDetails(user.organizationId, body);
  }

  @Put('my-organization/onboarding/docs')
  async updateComplianceDocuments(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateComplianceDocuments(user.organizationId, body);
  }

  @Put('my-organization/onboarding/catalog')
  async updateCatalog(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateCatalog(user.organizationId, body);
  }

  @Get('my-organization/onboarding')
  async getOnboardingStatus(@CurrentUser() user: any) {
    return this.organizationsService.getOnboardingStatus(user.organizationId);
  }

  @Get('my-organization/onboarding/review')
  async getOnboardingReviewSummary(@CurrentUser() user: any) {
    return this.organizationsService.getOnboardingReviewSummary(user.organizationId);
  }

  @Post('my-organization/onboarding/submit')
  async submitOnboarding(@CurrentUser() user: any) {
    return this.organizationsService.submitOnboarding(user.organizationId);
  }

  // ADMIN ENDPOINTS
  @Get('admin/kyc/pending')
  async getPendingKycSubmissions() {
    return this.kycAdminService.getPendingKycSubmissions();
  }

  @Get('admin/kyc/:kycCaseId')
  async getKycCaseDetails(@Param('kycCaseId') kycCaseId: string) {
    return this.kycAdminService.getKycCaseById(kycCaseId);
  }

  @Post('admin/kyc/:kycCaseId/approve')
  async approveKyc(
    @Param('kycCaseId') kycCaseId: string,
    @CurrentUser() admin: any,
    @Body() body: { remarks?: string },
  ) {
    return this.kycAdminService.approveKycSubmission(kycCaseId, admin.userId, body.remarks);
  }

  @Post('admin/kyc/:kycCaseId/reject')
  async rejectKyc(
    @Param('kycCaseId') kycCaseId: string,
    @CurrentUser() admin: any,
    @Body() body: { rejectionReason: string },
  ) {
    return this.kycAdminService.rejectKycSubmission(kycCaseId, admin.userId, body.rejectionReason);
  }

  @Get('admin/kyc/:orgId/history')
  async getKycHistory(@Param('orgId') orgId: string) {
    return this.kycAdminService.getKycCaseHistory(orgId);
  }
}
