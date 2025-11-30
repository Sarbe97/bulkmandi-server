import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { CurrentUser } from "@modules/auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@modules/auth/guards/roles.guard";

// Import all DTOs (both common and role-specific)
import { DocumentHandlerService } from "@core/file/services/document-handler.service";
import { multerOptions } from "../config/multer.config";
import { BuyerPreferencesDto, SellerCatalogDto, UserBankDto, UserDocsDto, UserOrgKycDto } from "../dto";
import { FleetAndComplianceFormDataDto } from "../dto/fleet-compliance.dto";
import { UserOnboardingService } from "../services/user-onboarding.service";

@ApiTags("User Onboarding (Buyer, Seller, Logistic)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("user/onboarding")
export class UserOnboardingController {
  constructor(
    private readonly service: UserOnboardingService,
    private readonly documentHandlerService: DocumentHandlerService,
    private readonly logger: CustomLoggerService,
  ) {}

  // ===== COMMON STEPS FOR ALL ROLES =====

  /**
   * Step 1: Update Organization KYC
   * Works for: Buyer, Seller, Logistic
   */
  @Put("org-kyc")
  @ApiOperation({
    summary: "Step 1: Update organization KYC details",
    description: "Update legal name, GSTIN, PAN, address, contact info - same for all roles",
  })
  async updateOrgKyc(@CurrentUser() user: any, @Body() dto: UserOrgKycDto): Promise<any> {
    this.logger.log(`PUT user/onboarding/org-kyc by user=${user.userId}, org=${user.organizationId}, role=${user.role}`);
    return this.service.updateOrgKyc(user.organizationId, dto, user.role);
  }

  /**
   * Phase 1: Upload Document to Storage (no DB persist)
   */
  @Post("documents/upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("document", multerOptions))
  @ApiOperation({
    summary: "Upload document to storage (Phase 1)",
    description: "Upload file. Returns fileUrl for later use in Phase 2.",
  })
  async uploadDocument(@CurrentUser() user: any, @Body() body: { docType: string }, @UploadedFile() file?: Express.Multer.File): Promise<any> {
    if (!file) throw new BadRequestException("File is required");
    if (!body.docType) throw new BadRequestException("docType is required");

    return this.documentHandlerService.uploadDocument(user.organizationId, file, body.docType);
  }

  /**
   * Phase 1: Delete Document from Storage
   */
  @Delete("documents/:docType")
  @ApiOperation({
    summary: "Delete document from storage",
    description: "Delete uploaded file. No DB changes.",
  })
  async deleteDocument(@CurrentUser() user: any, @Param("docType") docType: string): Promise<any> {
    return this.documentHandlerService.deleteDocument(user.organizationId, docType);
  }

  /**
   * Step 2: Update Bank Details
   * Works for: Buyer, Seller, Logistic
   */
  @Put("bank-details")
  @ApiOperation({
    summary: "Step 2: Update bank account details",
    description: "Same for all roles",
  })
  async updateBankDetails(@CurrentUser() user: any, @Body() dto: UserBankDto): Promise<any> {
    this.logger.log(`PUT user/onboarding/bank-details by user=${user.userId}, org=${user.organizationId}`);
    return this.service.updateBankDetails(user.organizationId, dto, user.role);
  }

  /**
   * Step 3: Update Compliance Docs
   * Works for: Buyer, Seller, Logistic
   */
  @Put("compliance-docs")
  @ApiOperation({
    summary: "Step 3: Update compliance documents & declarations",
    description: "Same for all roles",
  })
  async updateComplianceDocs(@CurrentUser() user: any, @Body() dto: UserDocsDto): Promise<any> {
    this.logger.log(`PUT user/onboarding/compliance-docs by user=${user.userId}, org=${user.organizationId}`);
    return this.service.updateComplianceDocs(user.organizationId, dto, user.role);
  }

  // ===== ROLE-SPECIFIC STEPS =====

  /**
   * Step 4 (Buyer Only): Update Buyer Preferences
   */
  @Put("buyer-preferences")
  @ApiOperation({
    summary: "Step 4 (Buyer Only): Update buyer preferences",
    description: "Set product categories, delivery pins, QC requirements, notifications",
  })
  async updateBuyerPreferences(@CurrentUser() user: any, @Body() dto: BuyerPreferencesDto): Promise<any> {
    this.logger.log(`PUT user/onboarding/buyer-preferences by user=${user.userId}`);
    return this.service.updateRoleSpecificStep(user.organizationId, "buyer-preferences", dto, user.role, UserRole.BUYER);
  }

  /**
   * Step 4 (Seller Only): Update Catalog & Price
   */
  @Put("catalog")
  @ApiOperation({
    summary: "Step 4 (Seller Only): Update product catalog and pricing",
    description: "Set products, price floors, and logistics preferences",
  })
  async updateCatalog(@CurrentUser() user: any, @Body() dto: SellerCatalogDto): Promise<any> {
    this.logger.log(`PUT user/onboarding/catalog by user=${user.userId}`);
    return this.service.updateRoleSpecificStep(user.organizationId, "catalog", dto, user.role, UserRole.SELLER);
  }

  @Put("fleet-compliance")
  @UseGuards(JwtAuthGuard)
  async updateFleetAndCompliance(@CurrentUser() user: any, @Body() dto: FleetAndComplianceFormDataDto) {
    return this.service.updateFleetAndCompliance(user.organizationId, dto, user.role);
  }
  // ===== COMMON SUBMISSION & STATUS ENDPOINTS =====

  /**
   * Get Onboarding Progress
   */
  @Get("progress")
  @ApiOperation({
    summary: "Get onboarding progress",
    description: "Returns completed steps, progress percentage, next step",
  })
  async getProgress(@CurrentUser() user: any): Promise<any> {
    this.logger.log(`GET user/onboarding/progress by user=${user.userId}, role=${user.role}`);
    return this.service.getProgress(user.organizationId, user.role);
  }

  /**
   * Get Complete Onboarding Data
   */
  @Get("data")
  @ApiOperation({
    summary: "Get complete onboarding data for review",
    description: "Returns all entered information before submission",
  })
  async getOnboardingData(@CurrentUser() user: any): Promise<any> {
    this.logger.log(`GET user/onboarding/data by user=${user.userId}, role=${user.role}`);
    return this.service.getOnboardingData(user.organizationId);
  }

  /**
   * Submit Onboarding for KYC
   */

  @Post("submit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Submit onboarding for KYC verification",
    description: "Validates all required steps, creates KYC case, locks onboarding",
  })
  async submitOnboarding(@CurrentUser() user: any, @Body() dto: any): Promise<any> {
    this.logger.log(`POST user/onboarding/submit by user=${user.userId}, role=${user.role}`);
    return this.service.submitOnboarding(user.organizationId, user.role);
  }
}
