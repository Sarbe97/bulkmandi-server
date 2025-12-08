import { Body, Controller, ForbiddenException, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { FileStorageService } from "../../core/file/services/file-storage.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("Organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService,
  ) { }

  /**
   * Extract organization ID from authenticated user
   */
  private getOrganizationId(user: any): string {
    if (!user || !user.organizationId) {
      this.logger.log("Forbidden access: User not linked to organization", "OrganizationsController.getOrganizationId");
      throw new ForbiddenException("User not linked to organization");
    }
    this.logger.log(`Extracted organizationId ${user.organizationId} from user`, "OrganizationsController.getOrganizationId");
    return user.organizationId;
  }

  /**
   * Download document (with authorization check)
   * GET /organizations/my-organization/documents/:fileName
   */
  @Get("my-organization/documents/:fileName")
  @ApiOperation({
    summary: "Download document",
    description: "Download a document with authorization check",
  })
  @ApiParam({ name: "fileName", description: "File name to download" })
  async downloadDocument(@CurrentUser() user: any, @Param("fileName") fileName: string, @Res() res: any) {
    this.logger.log(`GET /organizations/my-organization/documents/:${fileName} called`, "OrganizationsController.downloadDocument");
    const orgId = this.getOrganizationId(user);

    try {
      const fileUrl = `/documents/organizations/${orgId}/${fileName}`;
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      this.logger.log(`File fetched successfully for download: ${fileName}`, "OrganizationsController.downloadDocument");

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      this.logger.log(`Error downloading file ${fileName}: ${error.message}`, "OrganizationsController.downloadDocument");
      throw new ForbiddenException(error.message);
    }
  }

  /**
   * Preview document inline (with authorization check)
   * GET /organizations/my-organization/documents-preview/:fileName
   */
  @Get("my-organization/documents-preview/:fileName")
  @ApiOperation({
    summary: "Preview document inline",
    description: "Preview a document inline with authorization check",
  })
  @ApiParam({ name: "fileName", description: "File name to preview" })
  async previewDocument(@CurrentUser() user: any, @Param("fileName") fileName: string, @Res() res: any) {
    this.logger.log(`GET /organizations/my-organization/documents-preview/:${fileName} called`, "OrganizationsController.previewDocument");
    const orgId = this.getOrganizationId(user);

    try {
      const fileUrl = `/documents/organizations/${orgId}/${fileName}`;
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      this.logger.log(`File fetched successfully for preview: ${fileName}`, "OrganizationsController.previewDocument");

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
      this.logger.log(`Error previewing file ${fileName}: ${error.message}`, "OrganizationsController.previewDocument");
      throw new ForbiddenException(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  @Post("validate-invite-code")
  @ApiOperation({ summary: "Validate an invite code" })
  async validateCode(@Body() body: { inviteCode: string }) {
    return this.organizationsService.validateInviteCode(body.inviteCode);
  }
}
