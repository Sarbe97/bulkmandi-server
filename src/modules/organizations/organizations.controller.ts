import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FileStorageService } from "../storage/services/file-storage.service";
import { OrganizationsService } from "./organizations.service";
import { DocumentUplod } from "./schemas/organization.schema";

const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException("Invalid file type. Only PDF, JPG, PNG, DOC, DOCX allowed"), false);
    }
  },
};

@ApiTags("Organizations - Seller Onboarding")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService,
  ) {}

  private getOrganizationId(user: any): string {
    if (!user || !user.organizationId) {
      this.logger.log("Forbidden access: User not linked to organization", "getOrganizationId");
      throw new ForbiddenException("User not linked to organization");
    }
    this.logger.log(`Extracted organizationId ${user.organizationId} from user`, "getOrganizationId");
    return user.organizationId;
  }

  @Put("my-organization/onboarding/kyc")
  @ApiOperation({ summary: "Update organization KYC details" })
  async updateOrgKyc(@CurrentUser() user: any, @Body() body: any) {
    this.logger.log("Called updateOrgKyc", "updateOrgKyc");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Updating KYC for orgId ${orgId}`, "updateOrgKyc");
    const result = await this.organizationsService.updateOrgKyc(orgId, body);
    this.logger.log(`Updated KYC for orgId ${orgId}`, "updateOrgKyc");
    return result;
  }

  @Post("my-organization/onboarding/documents/upload")
  @ApiOperation({ summary: "Upload single document - Phase 1 (Storage only, no DB)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("document", multerOptions))
  async uploadSingleDocument(@CurrentUser() user: any, @Body() body: { docType: string }, @UploadedFile() file?: Express.Multer.File) {
    this.logger.log("Called uploadSingleDocument", "uploadSingleDocument");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Uploading document for orgId ${orgId}, docType: ${body.docType}, fileName: ${file?.originalname}`, "uploadSingleDocument");

    if (!file) {
      this.logger.log("File missing in uploadSingleDocument", "uploadSingleDocument");
      throw new BadRequestException("File is required");
    }
    if (!body.docType) {
      this.logger.log("docType missing in uploadSingleDocument", "uploadSingleDocument");
      throw new BadRequestException("docType is required");
    }

    const result = await this.organizationsService.uploadSingleDocument(orgId, file, body.docType);
    this.logger.log(`Uploaded document successfully for orgId ${orgId}`, "uploadSingleDocument");
    return result;
  }

  @Delete("my-organization/onboarding/documents/:docType")
  @ApiOperation({ summary: "Delete document - Phase 1 (Storage only, no DB)" })
  @ApiParam({ name: "docType", description: "Document type to delete" })
  async deleteDocument(@CurrentUser() user: any, @Param("docType") docType: string) {
    this.logger.log(`Called deleteDocument with docType ${docType}`, "deleteDocument");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Deleting document for orgId ${orgId}, docType: ${docType}`, "deleteDocument");

    const result = await this.organizationsService.deleteDocument(orgId, docType);
    this.logger.log(`Deleted document for orgId ${orgId}, docType: ${docType}`, "deleteDocument");
    return result;
  }

  @Put("my-organization/onboarding/bank-details")
  @ApiOperation({ summary: "Save bank details + documents - Phase 2 (Persists to DB)" })
  async updateBankDetailsWithDocuments(
    @CurrentUser() user: any,
    @Body()
    body: {
      accountNumber: string;
      ifsc: string;
      bankName: string;
      accountHolderName: string;
      pennyDropStatus?: string;
      pennyDropScore?: number;
      documents: Array<DocumentUplod>;
    },
  ) {
    this.logger.log("Called updateBankDetailsWithDocuments", "updateBankDetailsWithDocuments");
    const orgId = this.getOrganizationId(user);
    this.logger.log(
      `Persisting bank details for orgId ${orgId}, accountNumber: ${body.accountNumber}, documentsCount: ${body.documents.length}`,
      "updateBankDetailsWithDocuments",
    );

    const result = await this.organizationsService.updateBankDetailsWithDocuments(orgId, body);
    this.logger.log(`Persisted bank details for orgId ${orgId}`, "updateBankDetailsWithDocuments");
    return result;
  }

  @Put("my-organization/onboarding/compliance")
  @ApiOperation({ summary: "Save compliance docs + declarations - Phase 2 (Persists to DB)" })
  async updateComplianceDocsWithDeclarations(
    @CurrentUser() user: any,
    @Body()
    body: {
      warrantyAssurance: boolean;
      termsAccepted: boolean;
      amlCompliance: boolean;
      documents: Array<DocumentUplod>;
    },
  ) {
    this.logger.log("Called updateComplianceDocsWithDeclarations", "updateComplianceDocsWithDeclarations");
    const orgId = this.getOrganizationId(user);
    this.logger.log(
      `Persisting compliance docs for orgId ${orgId}, documentsCount: ${body.documents.length}`,
      "updateComplianceDocsWithDeclarations",
    );

    const result = await this.organizationsService.updateComplianceDocsWithDeclarations(orgId, body);
    this.logger.log(`Persisted compliance docs for orgId ${orgId}`, "updateComplianceDocsWithDeclarations");
    return result;
  }

  @Put("my-organization/onboarding/catalog")
  @ApiOperation({ summary: "Update product catalog and pricing" })
  async updateCatalog(@CurrentUser() user: any, @Body() body: any) {
    this.logger.log("Called updateCatalog", "updateCatalog");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Updating catalog for orgId ${orgId}`, "updateCatalog");

    const result = await this.organizationsService.updateCatalog(orgId, body);
    this.logger.log(`Updated catalog for orgId ${orgId}`, "updateCatalog");
    return result;
  }

  @Get("my-organization/onboarding")
  @ApiOperation({ summary: "Get current onboarding status" })
  async getOnboardingStatus(@CurrentUser() user: any) {
    this.logger.log("Called getOnboardingStatus", "getOnboardingStatus");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Fetching onboarding status for orgId ${orgId}`, "getOnboardingStatus");

    const result = await this.organizationsService.getOnboardingData(orgId);
    this.logger.log(`Fetched onboarding status for orgId ${orgId}`, "getOnboardingStatus");
    return result;
  }

  @Post("my-organization/onboarding/submit")
  @ApiOperation({ summary: "Submit onboarding for admin review" })
  async submitOnboarding(@CurrentUser() user: any) {
    this.logger.log("Called submitOnboarding", "submitOnboarding");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Submitting onboarding for orgId ${orgId}`, "submitOnboarding");

    const result = await this.organizationsService.submitOnboarding(orgId);
    this.logger.log(`Submitted onboarding for orgId ${orgId}`, "submitOnboarding");
    return result;
  }

  @Get("my-organization/documents/:fileName")
  @ApiOperation({ summary: "Download document (with authorization check)" })
  @ApiParam({ name: "fileName", description: "File name to download" })
  async downloadDocument(@CurrentUser() user: any, @Param("fileName") fileName: string, @Res() res: any) {
    this.logger.log(`Called downloadDocument for file ${fileName}`, "downloadDocument");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Attempting to download file ${fileName} for orgId ${orgId}`, "downloadDocument");

    try {
      const fileUrl = `/documents/organizations/${orgId}/${fileName}`;
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      this.logger.log(`File fetched successfully for download: ${fileName}`, "downloadDocument");

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      this.logger.log(`Error downloading file ${fileName}: ${error.message}`, "downloadDocument");
      throw new ForbiddenException(error.message);
    }
  }

  @Get("my-organization/documents-preview/:fileName")
  @ApiOperation({ summary: "Preview document inline (with authorization check)" })
  @ApiParam({ name: "fileName", description: "File name to preview" })
  async previewDocument(@CurrentUser() user: any, @Param("fileName") fileName: string, @Res() res: any) {
    this.logger.log(`Called previewDocument for file ${fileName}`, "previewDocument");
    const orgId = this.getOrganizationId(user);
    this.logger.log(`Attempting to preview file ${fileName} for orgId ${orgId}`, "previewDocument");

    try {
      const fileUrl = `/documents/organizations/${orgId}/${fileName}`;
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      this.logger.log(`File fetched successfully for preview: ${fileName}`, "previewDocument");

      const ext = fileName.toLowerCase().split(".").pop();
      const contentTypeMap = {
        pdf: "application/pdf",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      this.logger.log(`Error previewing file ${fileName}: ${error.message}`, "previewDocument");
      throw new ForbiddenException(error.message);
    }
  }

  // @Post("my-organization/request-kyc-update")
  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: "Request permission to update approved KYC",
  //   description: "Seller can request to update specific fields after KYC is approved",
  // })
  // @ApiTags("Organizations - KYC Management")
  // async requestKycUpdate(
  //   @CurrentUser() user: any,
  //   @Body()
  //   body: {
  //     reason: string; 
  //   },
  // ): Promise<any> {
  //   this.logger.log("Called requestKycUpdate endpoint", "requestKycUpdate");

  //   const orgId = this.getOrganizationId(user);

  //   this.logger.log(`Requesting KYC update for org ${orgId}`, "requestKycUpdate");

  //   return this.organizationsService.requestKycUpdate(orgId, body);
  // }
}
