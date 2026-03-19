import { Body, Controller, Param, Post, UseGuards, Get, Query, Res, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { FileStorageService } from "src/core/file/services/file-storage.service";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService,
  ) {}

  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN, UserRole['3PL'])
  @Post(':entityId/upload')
  async uploadDocument(
    @Param('entityId') entityId: string,
    @Body() uploadDocumentDto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(entityId, uploadDocumentDto);
  }

  @Roles(UserRole.ADMIN)
  @Get("file")
  @ApiOperation({ summary: "Fetch document file securely for admins" })
  async getFile(@Query("url") fileUrl: string, @Res() res: any) {
    this.logger.log(`GET /documents/file?url=${fileUrl} called`, "DocumentsController");
    try {
      const orgIdMatch = fileUrl.match(/\/organizations\/([a-zA-Z0-9]+)\//);
      if (!orgIdMatch) throw new ForbiddenException("Invalid file URL format");
      const orgId = orgIdMatch[1];
      
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl: fileUrl,
        organizationId: orgId,
      });

      const fileName = fileUrl.split('/').pop() || "document";
      const ext = fileName.toLowerCase().split(".").pop();
      const contentTypeMap = {
        pdf: "application/pdf",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      res.setHeader("Content-Type", contentTypeMap[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      this.logger.log(`Error fetching file: ${error.message}`, "DocumentsController");
      throw new ForbiddenException(error.message);
    }
  }
}
