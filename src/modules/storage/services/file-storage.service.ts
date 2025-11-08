import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ✅ Type Definitions
interface UploadFileOptions {
  file: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}

interface SaveFileOptions {
  file: Buffer;
  organizationId: string;
  folderType: string; // 'bank', 'compliance', 'kyc', etc.
  docType?: string; // CANCELLED_CHEQUE, BANK_PASSBOOK, etc.
  metadata?: Record<string, any>;
}

interface SaveFileResponse {
  fileUrl: string;
  storagePath: string;
  fileName: string;
  docType?: string;
}

interface DeleteFileOptions {
  fileUrl: string;
  organizationId?: string; // For authorization check
}

/**
 * File Storage Service
 * Handles local file storage with organization-based directory structure
 * Supports immediate single file uploads for document management
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseUploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadDir();
  }

  
  private ensureUploadDir(): void {
    try {
      if (!fs.existsSync(this.baseUploadDir)) {
        fs.mkdirSync(this.baseUploadDir, { recursive: true });
        this.logger.log(`📁 Created upload directory: ${this.baseUploadDir}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to create upload directory: ${error.message}`);
      throw error;
    }
  }


  async uploadFile(options: UploadFileOptions): Promise<string> {
    try {
      const { file, fileName, mimeType, folder } = options;

      console.log(`📤 uploadFile called`);
      console.log(`  File: ${fileName} (${file.length} bytes)`);
      console.log(`  MimeType: ${mimeType}`);
      console.log(`  Folder: ${folder}`);

      // ✅ Validate inputs
      if (!file || file.length === 0) {
        throw new BadRequestException('File buffer is empty');
      }

      if (!fileName) {
        throw new BadRequestException('File name is required');
      }

      if (!folder) {
        throw new BadRequestException('Folder path is required');
      }

      // ✅ Validate file size (10MB limit)
      const maxFileSize = 10 * 1024 * 1024;
      if (file.length > maxFileSize) {
        throw new BadRequestException(
          `File size exceeds limit. Max: 10MB, Received: ${(file.length / 1024 / 1024).toFixed(2)}MB`
        );
      }

      // ✅ Build full directory path
      const fullDir = path.join(this.baseUploadDir, folder);

      // ✅ Security: Verify path is within baseUploadDir (prevent path traversal)
      const resolvedFullDir = path.resolve(fullDir);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedFullDir.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      // ✅ Create directory if not exists
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
        this.logger.log(`📁 Created directory: ${fullDir}`);
      }

      // ✅ Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      const ext = path.extname(fileName);
      const basename = path.basename(fileName, ext);
      const uniqueFileName = `${basename}_${timestamp}_${hash}${ext}`;

      // ✅ Full server storage path
      const storagePath = path.join(fullDir, uniqueFileName);

      // ✅ Double-check security
      const resolvedStoragePath = path.resolve(storagePath);
      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid storage path: Path traversal detected');
      }

      // ✅ Write file to disk
      fs.writeFileSync(storagePath, file);
      this.logger.log(
        `✅ File saved successfully: ${storagePath} (${(file.length / 1024).toFixed(2)}KB)`
      );

      // ✅ Build file URL (public accessible path)
      const fileUrl = `/documents/${folder}/${uniqueFileName}`;
      this.logger.log(`🔗 File URL: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`❌ Error in uploadFile: ${error.message}`, error.stack);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

 
  async saveFile(options: SaveFileOptions): Promise<SaveFileResponse> {
    try {
      const { file, organizationId, folderType, docType, metadata } = options;

      console.log(`📋 saveFile called`);
      console.log(`  OrgId: ${organizationId}`);
      console.log(`  FolderType: ${folderType}`);
      console.log(`  DocType: ${docType}`);

      // ✅ Validate inputs
      if (!file || file.length === 0) {
        throw new BadRequestException('File is required');
      }

      if (!organizationId) {
        throw new BadRequestException('Organization ID is required');
      }

      if (!folderType) {
        throw new BadRequestException('Folder type is required');
      }

      // ✅ Validate file size (10MB limit)
      const maxFileSize = 10 * 1024 * 1024;
      if (file.length > maxFileSize) {
        throw new BadRequestException(
          `File size exceeds limit. Max: 10MB, Received: ${(file.length / 1024 / 1024).toFixed(2)}MB`
        );
      }

      // ✅ Build directory path (include docType if provided)
      let orgDir: string;
      if (docType) {
        orgDir = path.join(
          this.baseUploadDir,
          'organizations',
          organizationId,
          folderType,
          docType
        );
        this.logger.log(`Saving file with docType: ${docType} in path: ${orgDir}`);
      } else {
        orgDir = path.join(this.baseUploadDir, 'organizations', organizationId, folderType);
        this.logger.log(`Saving file without docType in path: ${orgDir}`);
      }

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedOrgDir = path.resolve(orgDir);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedOrgDir.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      // ✅ Create directory if not exists
      if (!fs.existsSync(orgDir)) {
        fs.mkdirSync(orgDir, { recursive: true });
        this.logger.log(`📁 Created directory: ${orgDir}`);
      }

      // ✅ Generate unique filename
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString('hex');
      const ext = path.extname(metadata?.originalFileName || 'file');
      const basename = path.basename(metadata?.originalFileName || 'file', ext);

      let uniqueFilename: string;
      if (docType) {
        uniqueFilename = `${basename}_${timestamp}_${docType}_${hash}${ext}`;
      } else {
        uniqueFilename = `${basename}_${timestamp}_${hash}${ext}`;
      }

      // ✅ Full server path
      const storagePath = path.join(orgDir, uniqueFilename);

      // ✅ Double-check security
      const resolvedStoragePath = path.resolve(storagePath);
      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      // ✅ Write file
      fs.writeFileSync(storagePath, file);
      this.logger.log(
        `✅ File saved successfully: ${storagePath} (${(file.length / 1024).toFixed(2)}KB)`
      );

      // ✅ Build file URL
      let fileUrl: string;
      if (docType) {
        fileUrl = `/documents/organizations/${organizationId}/${folderType}/${docType}/${uniqueFilename}`;
      } else {
        fileUrl = `/documents/organizations/${organizationId}/${folderType}/${uniqueFilename}`;
      }

      this.logger.log(`🔗 File URL: ${fileUrl}`);

      // ✅ Return response
      return {
        fileUrl,
        storagePath,
        fileName: metadata?.originalFileName || uniqueFilename,
        docType,
      };
    } catch (error) {
      this.logger.error(`❌ Error in saveFile: ${error.message}`, error.stack);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to save file: ${error.message}`);
    }
  }

  
  async readFileSecure(options: {
    fileUrl: string;
    organizationId: string;
  }): Promise<Buffer> {
    try {
      const { fileUrl, organizationId } = options;

      this.logger.log(`📖 Reading file: ${fileUrl}`);

      // ✅ Security: Verify the fileUrl belongs to this organization
      if (!fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException(
          'Unauthorized: File does not belong to your organization'
        );
      }

      // ✅ Reconstruct full path from URL
      const storagePath = path.join(
        this.baseUploadDir,
        fileUrl.replace('/documents/', '')
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedStoragePath = path.resolve(storagePath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      // ✅ Verify file exists
      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException('File not found');
      }

      // ✅ Read and return file
      const fileBuffer = fs.readFileSync(storagePath);
      this.logger.log(`✅ File read successfully: ${storagePath} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);

      return fileBuffer;
    } catch (error) {
      this.logger.error(`❌ Error reading file: ${error.message}`, error.stack);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to read file: ${error.message}`);
    }
  }


  async deleteFile(options: DeleteFileOptions): Promise<void> {
    try {
      const { fileUrl, organizationId } = options;

      this.logger.log(`🗑️ Deleting file: ${fileUrl}`);

      // ✅ Optional security check
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException(
          'Unauthorized: File does not belong to your organization'
        );
      }

      // ✅ Reconstruct full path
      const storagePath = path.join(
        this.baseUploadDir,
        fileUrl.replace('/documents/', '')
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedStoragePath = path.resolve(storagePath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      // ✅ Delete file if exists
      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
        this.logger.log(`✅ File deleted: ${storagePath}`);
      } else {
        this.logger.warn(`⚠️ File not found to delete: ${storagePath}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error deleting file: ${error.message}`, error.stack);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

 
  async deleteDirectory(organizationId: string): Promise<void> {
    try {
      const orgDir = path.join(
        this.baseUploadDir,
        'organizations',
        organizationId
      );

      this.logger.log(`🗑️ Deleting directory: ${orgDir}`);

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedOrgDir = path.resolve(orgDir);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedOrgDir.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid directory path: Path traversal detected');
      }

      // ✅ Delete directory if exists
      if (fs.existsSync(orgDir)) {
        fs.rmSync(orgDir, { recursive: true, force: true });
        this.logger.log(`✅ Directory deleted: ${orgDir}`);
      } else {
        this.logger.warn(`⚠️ Directory not found to delete: ${orgDir}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error deleting directory: ${error.message}`, error.stack);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to delete directory: ${error.message}`);
    }
  }

   
  fileExists(fileUrl: string, organizationId?: string): boolean {
    try {
      // ✅ Optional security check
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        return false;
      }

      const storagePath = path.join(
        this.baseUploadDir,
        fileUrl.replace('/documents/', '')
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedStoragePath = path.resolve(storagePath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        return false;
      }

      return fs.existsSync(storagePath);
    } catch (error) {
      this.logger.error(`Error checking file existence: ${error.message}`);
      return false;
    }
  }

 
  getFileSize(fileUrl: string, organizationId?: string): number {
    try {
      // ✅ Optional security check
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException(
          'Unauthorized: File does not belong to your organization'
        );
      }

      const storagePath = path.join(
        this.baseUploadDir,
        fileUrl.replace('/documents/', '')
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedStoragePath = path.resolve(storagePath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException('File not found');
      }

      const stats = fs.statSync(storagePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`Error getting file size: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to get file size: ${error.message}`);
    }
  }

  
  listFiles(organizationId: string, folderType: string): string[] {
    try {
      const dirPath = path.join(
        this.baseUploadDir,
        'organizations',
        organizationId,
        folderType
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedDirPath = path.resolve(dirPath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedDirPath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid directory path: Path traversal detected');
      }

      if (!fs.existsSync(dirPath)) {
        return [];
      }

      const files = fs.readdirSync(dirPath, { recursive: true });
      return files.map((file) => file.toString());
    } catch (error) {
      this.logger.error(`Error listing files: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to list files: ${error.message}`);
    }
  }

   
  getFileInfo(fileUrl: string, organizationId?: string): {
    size: number;
    createdAt: Date;
    modifiedAt: Date;
  } {
    try {
      // ✅ Optional security check
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException(
          'Unauthorized: File does not belong to your organization'
        );
      }

      const storagePath = path.join(
        this.baseUploadDir,
        fileUrl.replace('/documents/', '')
      );

      // ✅ Security: Verify path is within baseUploadDir
      const resolvedStoragePath = path.resolve(storagePath);
      const resolvedBaseDir = path.resolve(this.baseUploadDir);

      if (!resolvedStoragePath.startsWith(resolvedBaseDir)) {
        throw new BadRequestException('Invalid file path: Path traversal detected');
      }

      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException('File not found');
      }

      const stats = fs.statSync(storagePath);

      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch (error) {
      this.logger.error(`Error getting file info: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to get file info: ${error.message}`);
    }
  }
}