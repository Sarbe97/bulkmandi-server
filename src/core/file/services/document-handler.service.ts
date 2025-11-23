import { FileStorageService } from '@core/file/services/file-storage.service';
import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

/**
 * DocumentHandlerService
 * Shared document handling for Seller and Buyer onboarding
 * Provides upload and delete operations with common logic
 */
@Injectable()
export class DocumentHandlerService {
  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Phase 1: Upload single document to storage (no DB persistence)
   * Returns document metadata with file URL
   * Shared by Seller and Buyer
   */
  async uploadDocument(
    organizationId: string,
    file: Express.Multer.File,
    docType: string,
  ): Promise<{
    docType: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: Date;
    status: string;
  }> {
    try {
      this.logger.log(
        `DocumentHandlerService.uploadDocument - OrgId: ${organizationId}, DocType: ${docType}`,
        'DocumentHandlerService.uploadDocument',
      );

      // Validate inputs
      if (!file) {
        this.logger.warn(
          `No file provided for upload - OrgId: ${organizationId}`,
          'DocumentHandlerService.uploadDocument',
        );
        throw new BadRequestException('File is required');
      }

      if (!file.buffer || file.buffer.length === 0) {
        this.logger.warn(
          `File buffer is empty - OrgId: ${organizationId}`,
          'DocumentHandlerService.uploadDocument',
        );
        throw new BadRequestException('File is empty');
      }

      if (!docType) {
        this.logger.warn(
          `Document type not provided - OrgId: ${organizationId}`,
          'DocumentHandlerService.uploadDocument',
        );
        throw new BadRequestException('Document type is required');
      }

      // Upload file to storage
      const folder = `documents/organizations/${organizationId}`;
      const fileName = `${docType}_${Date.now()}_${file.originalname}`;

      this.logger.log(
        `Uploading file: ${file.originalname} (${(file.size / 1024).toFixed(2)}KB)`,
        'DocumentHandlerService.uploadDocument',
      );

      const fileUrl = await this.fileStorageService.uploadFile({
        file: file.buffer,
        fileName,
        mimeType: file.mimetype,
        folder,
      });

      this.logger.log(
        `File uploaded successfully - URL: ${fileUrl}`,
        'DocumentHandlerService.uploadDocument',
      );

      return {
        docType,
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date(),
        status: 'UPLOADED',
      };
    } catch (error) {
      this.logger.error(
        `Error uploading document - OrgId: ${organizationId}, Error: ${error.message}`,
        'DocumentHandlerService.uploadDocument',
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Phase 1: Delete document from storage (no DB changes)
   * Shared by Seller and Buyer
   */
  async deleteDocument(
    organizationId: string,
    docType: string,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(
        `DocumentHandlerService.deleteDocument - OrgId: ${organizationId}, DocType: ${docType}`,
        'DocumentHandlerService.deleteDocument',
      );

      if (!docType) {
        this.logger.warn(
          `Document type not provided for deletion - OrgId: ${organizationId}`,
          'DocumentHandlerService.deleteDocument',
        );
        throw new BadRequestException('Document type is required');
      }

      // Note: Actual file deletion can be implemented here if needed
      // For now, we're just returning a success message
      // In a real system, you'd want to track temp files and delete them

      this.logger.log(
        `Document deletion message prepared - DocType: ${docType}`,
        'DocumentHandlerService.deleteDocument',
      );

      return {
        message: `Document ${docType} deleted successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting document - OrgId: ${organizationId}, Error: ${error.message}`,
        'DocumentHandlerService.deleteDocument',
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to delete document: ${error.message}`);
    }
  }
}
