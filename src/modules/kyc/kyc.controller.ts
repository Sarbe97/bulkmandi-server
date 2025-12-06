import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "src/common/guards/admin.guard";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KycAdminService } from "./services/kyc-admin.service";

@ApiTags("Admin KYC Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/kyc")
export class KycController {
  constructor(
    private readonly kycAdminService: KycAdminService,
    private readonly logger: CustomLoggerService,
  ) { }

  @Get("queue")
  @ApiOperation({ summary: "Get KYC verification queue" })
  @ApiQuery({ name: "status", required: false, enum: ["SUBMITTED", "APPROVED", "REJECTED", "INFO_REQUESTED", "REVISION_REQUESTED"] })
  @ApiQuery({ name: "role", required: false, enum: ["SELLER", "BUYER", "LOGISTIC"] })
  @ApiQuery({ name: "search", required: false, description: "Search by organization name" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  async getQueue(@Query() filters: { status?: string; role?: string; search?: string; page?: number; limit?: number }) {
    this.logger.log(`GET /admin/kyc/queue called with filters: ${JSON.stringify(filters)}`, "KycController");
    return this.kycAdminService.getKycQueue(filters);
  }

  @Get("case/:caseIdOrCode")
  @ApiOperation({ summary: "Get detailed KYC case information" })
  @ApiParam({
    name: "caseIdOrCode",
    description: "KYC Case Code (e.g., KYC-ORG-SEL-000123-001) or MongoDB ObjectId for backward compatibility",
    example: "KYC-ORG-SEL-000123-001"
  })
  async getCaseDetail(@Param("caseIdOrCode") caseIdOrCode: string) {
    this.logger.log(`GET /admin/kyc/case/${caseIdOrCode} called`, "KycController");
    return this.kycAdminService.getKycCaseDetail(caseIdOrCode);
  }

  @Post("case/:caseIdOrCode/approve")
  @ApiOperation({ summary: "Approve KYC case" })
  @ApiParam({
    name: "caseIdOrCode",
    description: "KYC Case Code or MongoDB ObjectId",
    example: "KYC-ORG-SEL-000123-001"
  })
  async approveCase(
    @Param("caseIdOrCode") caseIdOrCode: string,
    @CurrentUser() user: any,
    @Body() body: { remarks?: string }
  ) {
    this.logger.log(`POST /admin/kyc/case/${caseIdOrCode}/approve called by userId: ${user.userId} with remarks: ${body.remarks}`, "KycController");
    return this.kycAdminService.approveKycCase(caseIdOrCode, user.userId, body.remarks);
  }

  @Post("case/:caseIdOrCode/reject")
  @ApiOperation({ summary: "Reject KYC case" })
  @ApiParam({
    name: "caseIdOrCode",
    description: "KYC Case Code or MongoDB ObjectId",
    example: "KYC-ORG-SEL-000123-001"
  })
  async rejectCase(
    @Param("caseIdOrCode") caseIdOrCode: string,
    @CurrentUser() user: any,
    @Body() body: { rejectionReason: string }
  ) {
    this.logger.log(
      `POST /admin/kyc/case/${caseIdOrCode}/reject called by userId: ${user.userId} with rejectionReason: ${body.rejectionReason}`,
      "KycController",
    );
    return this.kycAdminService.rejectKycCase(caseIdOrCode, user.userId, body.rejectionReason);
  }

  @Post("case/:caseId/request-info")
  @ApiOperation({ summary: "Request more information from seller" })
  @ApiParam({ name: "caseId", description: "KYC Case ID" })
  async requestMoreInfo(@Param("caseId") caseId: string, @CurrentUser() user: any, @Body() body: { message: string; fields: string[] }) {
    this.logger.log(
      `POST /admin/kyc/case/${caseId}/request-info called by userId: ${user.userId} with fields: ${body.fields.join(", ")}`,
      "KycController",
    );
    return this.kycAdminService.requestMoreInfo(caseId, user.userId, body.message, body.fields);
  }

  @Post("case/:caseId/watchlist")
  @ApiOperation({ summary: "Add organization to watchlist" })
  @ApiParam({ name: "caseId", description: "KYC Case ID" })
  async addToWatchlist(@Param("caseId") caseId: string, @CurrentUser() user: any, @Body() body: { reason: string; tags: string[] }) {
    this.logger.log(
      `POST /admin/kyc/case/${caseId}/watchlist called by userId: ${user.userId} with reason: ${body.reason} and tags: ${body.tags.join(", ")}`,
      "KycController",
    );
    return this.kycAdminService.addToWatchlist(caseId, user.userId, body.reason, body.tags);
  }

  @Get("history/:orgId")
  @ApiOperation({ summary: "Get KYC case history for organization" })
  @ApiParam({ name: "orgId", description: "Organization ID" })
  async getCaseHistory(@Param("orgId") orgId: string) {
    this.logger.log(`GET /admin/kyc/history/${orgId} called`, "KycController");
    return this.kycAdminService.getKycCaseHistory(orgId);
  }

  @Post("case/:caseId/unlock-for-update")
  @ApiOperation({ summary: "Unlock approved KYC for seller updates" })
  async unlockForUpdate(@Param("caseId") caseId: string, @CurrentUser() user: any, @Body() body: { remarks?: string }) {
    this.logger.log(
      `POST /admin/kyc/case/${caseId}/unlock-for-update called by userId: ${user.userId} with remarks: ${body.remarks}`,
      "KycController",
    );
    return this.kycAdminService.unlockForUpdate(caseId, user.userId, body.remarks);
  }
}
