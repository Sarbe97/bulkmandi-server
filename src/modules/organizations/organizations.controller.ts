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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileStorageService } from '../storage/services/file-storage.service';
import { OrganizationsService } from './organizations.service';
import { DocumentUplod } from './schemas/organization.schema';

const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Invalid file type. Only PDF, JPG, PNG, DOC, DOCX allowed'), false);
    }
  },
};

@ApiTags('Organizations - Seller Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly fileStorageService: FileStorageService
  ) {}

  private getOrganizationId(user: any): string {
    if (!user || !user.organizationId) {
      throw new ForbiddenException('User not linked to organization');
    }
    return user.organizationId;
  }

  // ========== STEP 1: KYC DETAILS (No Files) ==========
  @Put('my-organization/onboarding/kyc')
  @ApiOperation({ summary: 'Update organization KYC details' })
  async updateOrgKyc(@CurrentUser() user: any, @Body() body: any) {
    const orgId = this.getOrganizationId(user);
    return this.organizationsService.updateOrgKyc(orgId, body);
  }

  // ========== STEP 2: BANK DETAILS ==========

  /**
   * ✅ PHASE 1: Upload Single Document (Storage Only - No DB Update)
   */
  @Post('my-organization/onboarding/documents/upload')
  @ApiOperation({ summary: 'Upload single document - Phase 1 (Storage only, no DB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('document', multerOptions))
  async uploadSingleDocument(
    @CurrentUser() user: any,
    @Body() body: { docType: string },
    @UploadedFile() file?: Express.Multer.File
  ) {
    const orgId = this.getOrganizationId(user);

    console.log('📤 PHASE 1: Upload single document');
    console.log(`  Organization: ${orgId}`);
    console.log(`  DocType: ${body.docType}`);
    console.log(`  File: ${file?.originalname}`);

    if (!file) throw new BadRequestException('File is required');
    if (!body.docType) throw new BadRequestException('docType is required');

    return this.organizationsService.uploadSingleDocument(orgId, file, body.docType);
  }

  /**
   * ✅ PHASE 1: Delete Document from Storage (No DB Update)
   */
  @Delete('my-organization/onboarding/documents/:docType')
  @ApiOperation({ summary: 'Delete document - Phase 1 (Storage only, no DB)' })
  @ApiParam({ name: 'docType', description: 'Document type to delete' })
  async deleteDocument(@CurrentUser() user: any, @Param('docType') docType: string) {
    const orgId = this.getOrganizationId(user);

    console.log('🗑️ PHASE 1: Delete document');
    console.log(`  Organization: ${orgId}`);
    console.log(`  DocType: ${docType}`);

    return this.organizationsService.deleteDocument(orgId, docType);
  }

  /**
   * ✅ PHASE 2: Update Bank Details + Documents (Persists to DB)
   */
  @Put('my-organization/onboarding/bank-details')
  @ApiOperation({ summary: 'Save bank details + documents - Phase 2 (Persists to DB)' })
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
    }
  ) {
    const orgId = this.getOrganizationId(user);

    console.log('💾 PHASE 2: Persist bank details + documents');
    console.log(`  Organization: ${orgId}`);
    console.log(`  Account: ${body.accountNumber}`);
    console.log(`  Documents: ${body.documents.length}`);

    return this.organizationsService.updateBankDetailsWithDocuments(orgId, body);
  }

  // ========== STEP 3: COMPLIANCE DOCUMENTS ==========

  /**
   * ✅ PHASE 2: Update Compliance Documents + Declarations (Persists to DB)
   */
  @Put('my-organization/onboarding/compliance')
  @ApiOperation({ summary: 'Save compliance docs + declarations - Phase 2 (Persists to DB)' })
  async updateComplianceDocsWithDeclarations(
    @CurrentUser() user: any,
    @Body()
    body: {
      warrantyAssurance: boolean;
      termsAccepted: boolean;
      amlCompliance: boolean;
      documents: Array<DocumentUplod>;
    }
  ) {
    const orgId = this.getOrganizationId(user);

    console.log('💾 PHASE 2: Persist compliance docs + declarations');
    console.log(`  Organization: ${orgId}`);
    console.log(`  Documents: ${body.documents.length}`);

    return this.organizationsService.updateComplianceDocsWithDeclarations(orgId, body);
  }

  // ========== STEP 4: CATALOG & PRICING ==========
  @Put('my-organization/onboarding/catalog')
  @ApiOperation({ summary: 'Update product catalog and pricing' })
  async updateCatalog(@CurrentUser() user: any, @Body() body: any) {
    const orgId = this.getOrganizationId(user);
    return this.organizationsService.updateCatalog(orgId, body);
  }

  // ========== GET FULL STATUS ==========
  @Get('my-organization/onboarding')
  @ApiOperation({ summary: 'Get current onboarding status' })
  async getOnboardingStatus(@CurrentUser() user: any) {
    const orgId = this.getOrganizationId(user);
    return this.organizationsService.getOnboardingData(orgId);
  }

  // ========== SUBMIT FOR REVIEW ==========
  @Post('my-organization/onboarding/submit')
  @ApiOperation({ summary: 'Submit onboarding for admin review' })
  async submitOnboarding(@CurrentUser() user: any) {
    const orgId = this.getOrganizationId(user);
    return this.organizationsService.submitOnboarding(orgId);
  }

  // ========== SECURE FILE DOWNLOAD ==========
  @Get('my-organization/documents/:fileName')
  @ApiOperation({ summary: 'Download document (with authorization check)' })
  @ApiParam({ name: 'fileName', description: 'File name to download' })
  async downloadDocument(@CurrentUser() user: any, @Param('fileName') fileName: string, @Res() res: any) {
    const orgId = this.getOrganizationId(user);
    const fileUrl = `/documents/organizations/${orgId}/${fileName}`;

    try {
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      throw new ForbiddenException(error.message);
    }
  }

  // ========== PREVIEW DOCUMENT ==========
  @Get('my-organization/documents-preview/:fileName')
  @ApiOperation({ summary: 'Preview document inline (with authorization check)' })
  @ApiParam({ name: 'fileName', description: 'File name to preview' })
  async previewDocument(@CurrentUser() user: any, @Param('fileName') fileName: string, @Res() res: any) {
    const orgId = this.getOrganizationId(user);
    const fileUrl = `/documents/organizations/${orgId}/${fileName}`;

    try {
      const fileBuffer = await this.fileStorageService.readFileSecure({
        fileUrl,
        organizationId: orgId,
      });

      const ext = fileName.toLowerCase().split('.').pop();
      const contentTypeMap = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      const contentType = contentTypeMap[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      throw new ForbiddenException(error.message);
    }
  }
}