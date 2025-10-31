import { Body, Controller, ForbiddenException, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations - Seller Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ========== SELLER ONBOARDING ENDPOINTS ==========

  @Put('my-organization/onboarding/kyc')
  @ApiOperation({ summary: 'Update organization KYC details' })
  async updateOrgKyc(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateOrgKyc(user.organizationId, body);
  }

  @Put('my-organization/onboarding/bank')
  @ApiOperation({ summary: 'Update bank account details' })
  async updateBankDetails(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateBankDetails(user.organizationId, body);
  }

  @Put('my-organization/onboarding/docs')
  @ApiOperation({ summary: 'Upload compliance documents' })
  async updateComplianceDocuments(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateComplianceDocuments(user.organizationId, body);
  }

  @Put('my-organization/onboarding/catalog')
  @ApiOperation({ summary: 'Update product catalog and commercials' })
  async updateCatalog(@CurrentUser() user: any, @Body() body: any) {
    return this.organizationsService.updateCatalog(user.organizationId, body);
  }

@Get('my-organization/onboarding')
@ApiOperation({ summary: 'Get current onboarding status' })
async getOnboardingStatus(@CurrentUser() user: any) {
  console.log('🔍 DEBUG - User object:', user); // ADD THIS
  console.log('🔍 DEBUG - User type:', typeof user); // ADD THIS
  
  if (!user) {
    throw new ForbiddenException('User object is undefined. JWT authentication failed.');
  }
  
  if (!user.organizationId) {
    throw new ForbiddenException('organizationId not found in JWT. User is not linked to organization.');
  }
  
  return this.organizationsService.getOnboardingStatus(user.organizationId);
}


  @Get('my-organization/onboarding/review')
  @ApiOperation({ summary: 'Get onboarding review summary' })
  async getOnboardingReviewSummary(@CurrentUser() user: any) {
    return this.organizationsService.getOnboardingReviewSummary(user.organizationId);
  }

  @Post('my-organization/onboarding/submit')
  @ApiOperation({ summary: 'Submit onboarding for admin review' })
  async submitOnboarding(@CurrentUser() user: any) {
    return this.organizationsService.submitOnboarding(user.organizationId);
  }
}
