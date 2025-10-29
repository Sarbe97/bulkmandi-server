import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycCaseService } from './kyc.service';
 

@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycCaseService) {}

  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.THREE_PL)
  @Post()
  async submitKYC(@CurrentUser() user: any, @Body() dto: SubmitKycDto) {
    return this.kycService.submitKYC(user.organizationId, dto);
  }

  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.THREE_PL)
  @Get('me')
  async getMyKYC(@CurrentUser() user: any) {
    return this.kycService.getKYCByOrgId(user.organizationId);
  }

  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.THREE_PL)
  @Put('me/step/:stepName')
  async updateKYCStep(
    @CurrentUser() user: any,
    @Param('stepName') stepName: string,
    @Body() stepData: any,
  ) {
    return this.kycService.updateStep(user.organizationId, stepName, stepData);
  }

  @Roles(UserRole.ADMIN)
  @Get('case/:caseId')
  async getKYCCase(@Param('caseId') caseId: string) {
    return this.kycService.getKYCByCaseId(caseId);
  }
}
