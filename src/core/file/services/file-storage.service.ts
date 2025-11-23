import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

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
 * FileStorageService
 * Handles local file storage with organization-based directory structure
 * Provides secure file operations with path traversal prevention
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseUploadDir = path.join(process.cwd(), "uploads");
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor() {
    this.ensureUploadDir();
  }

  /**
   * Initialize uploads directory
   */
  private ensureUploadDir(): void {
    try {
      if (!fs.existsSync(this.baseUploadDir)) {
        fs.mkdirSync(this.baseUploadDir, { recursive: true });
        this.logger.log(`Created upload directory: ${this.baseUploadDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate file path is within baseUploadDir (security check)
   */
  private validatePathSecurity(resolvedPath: string): boolean {
    const resolvedBaseDir = path.resolve(this.baseUploadDir);
    return resolvedPath.startsWith(resolvedBaseDir);
  }

  /**
   * Upload file to storage
   */
  async uploadFile(options: UploadFileOptions): Promise<string> {
    try {
      const { file, fileName, mimeType, folder } = options;

      // Validate inputs
      if (!file || file.length === 0) {
        throw new BadRequestException("File buffer is empty");
      }
      if (!fileName) {
        throw new BadRequestException("File name is required");
      }
      if (!folder) {
        throw new BadRequestException("Folder path is required");
      }

      // Validate file size
      if (file.length > this.maxFileSize) {
        throw new BadRequestException(`File size exceeds limit. Max: 10MB, Received: ${(file.length / 1024 / 1024).toFixed(2)}MB`);
      }

      // Build directory path
      const fullDir = path.join(this.baseUploadDir, folder);
      const resolvedFullDir = path.resolve(fullDir);

      // Security check
      if (!this.validatePathSecurity(resolvedFullDir)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      // Create directory if not exists
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString("hex");
      const ext = path.extname(fileName);
      const basename = path.basename(fileName, ext);
      const uniqueFileName = `${basename}_${timestamp}_${hash}${ext}`;

      // Build storage path
      const storagePath = path.join(fullDir, uniqueFileName);
      const resolvedStoragePath = path.resolve(storagePath);

      // Final security check
      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid storage path: Path traversal detected");
      }

      // Write file to disk
      fs.writeFileSync(storagePath, file);
      this.logger.log(`File saved: ${storagePath} (${(file.length / 1024).toFixed(2)}KB)`);

      // Build and return file URL
      const fileUrl = `/documents/${folder}/${uniqueFileName}`;
      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Save file with organization-based directory structure
   */
  async saveFile(options: SaveFileOptions): Promise<SaveFileResponse> {
    try {
      const { file, organizationId, folderType, docType, metadata } = options;

      // Validate inputs
      if (!file || file.length === 0) {
        throw new BadRequestException("File is required");
      }
      if (!organizationId) {
        throw new BadRequestException("Organization ID is required");
      }
      if (!folderType) {
        throw new BadRequestException("Folder type is required");
      }

      // Validate file size
      if (file.length > this.maxFileSize) {
        throw new BadRequestException(`File size exceeds limit. Max: 10MB, Received: ${(file.length / 1024 / 1024).toFixed(2)}MB`);
      }

      // Build directory path
      let orgDir: string;
      if (docType) {
        orgDir = path.join(this.baseUploadDir, "organizations", organizationId, folderType, docType);
      } else {
        orgDir = path.join(this.baseUploadDir, "organizations", organizationId, folderType);
      }

      const resolvedOrgDir = path.resolve(orgDir);

      // Security check
      if (!this.validatePathSecurity(resolvedOrgDir)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      // Create directory if not exists
      if (!fs.existsSync(orgDir)) {
        fs.mkdirSync(orgDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const hash = crypto.randomBytes(4).toString("hex");
      const ext = path.extname(metadata?.originalFileName || "file");
      const basename = path.basename(metadata?.originalFileName || "file", ext);
      const uniqueFilename = docType ? `${basename}_${timestamp}_${docType}_${hash}${ext}` : `${basename}_${timestamp}_${hash}${ext}`;

      // Build storage path
      const storagePath = path.join(orgDir, uniqueFilename);
      const resolvedStoragePath = path.resolve(storagePath);

      // Final security check
      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      // Write file
      fs.writeFileSync(storagePath, file);
      this.logger.log(`File saved: ${storagePath} (${(file.length / 1024).toFixed(2)}KB)`);

      // Build file URL
      const fileUrl = docType
        ? `/documents/organizations/${organizationId}/${folderType}/${docType}/${uniqueFilename}`
        : `/documents/organizations/${organizationId}/${folderType}/${uniqueFilename}`;

      return {
        fileUrl,
        storagePath,
        fileName: metadata?.originalFileName || uniqueFilename,
        docType,
      };
    } catch (error) {
      this.logger.error(`Error saving file: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to save file: ${error.message}`);
    }
  }

  /**
   * Read file with organization authorization check
   */
  async readFileSecure(options: { fileUrl: string; organizationId: string }): Promise<Buffer> {
    try {
      const { fileUrl, organizationId } = options;

      // Security: Verify file belongs to organization
      if (!fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException("Unauthorized: File does not belong to your organization");
      }

      // Reconstruct full path
      const storagePath = path.join(this.baseUploadDir, fileUrl.replace("/documents/", ""));
      const resolvedStoragePath = path.resolve(storagePath);

      // Security check
      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      // Verify file exists
      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException("File not found");
      }

      // Read and return file
      const fileBuffer = fs.readFileSync(storagePath);
      this.logger.log(`File read: ${storagePath} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
      return fileBuffer;
    } catch (error) {
      this.logger.error(`Error reading file: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(options: DeleteFileOptions): Promise<void> {
    try {
      const { fileUrl, organizationId } = options;

      // Optional security check
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException("Unauthorized: File does not belong to your organization");
      }

      // Reconstruct full path
      const storagePath = path.join(this.baseUploadDir, fileUrl.replace("/documents/", ""));
      const resolvedStoragePath = path.resolve(storagePath);

      // Security check
      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      // Delete file if exists
      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
        this.logger.log(`File deleted: ${storagePath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete directory recursively
   */
  async deleteDirectory(organizationId: string): Promise<void> {
    try {
      const orgDir = path.join(this.baseUploadDir, "organizations", organizationId);
      const resolvedOrgDir = path.resolve(orgDir);

      // Security check
      if (!this.validatePathSecurity(resolvedOrgDir)) {
        throw new BadRequestException("Invalid directory path: Path traversal detected");
      }

      // Delete directory if exists
      if (fs.existsSync(orgDir)) {
        fs.rmSync(orgDir, { recursive: true, force: true });
        this.logger.log(`Directory deleted: ${orgDir}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting directory: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to delete directory: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  fileExists(fileUrl: string, organizationId?: string): boolean {
    try {
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        return false;
      }

      const storagePath = path.join(this.baseUploadDir, fileUrl.replace("/documents/", ""));
      const resolvedStoragePath = path.resolve(storagePath);

      if (!this.validatePathSecurity(resolvedStoragePath)) {
        return false;
      }

      return fs.existsSync(storagePath);
    } catch (error) {
      this.logger.error(`Error checking file existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Get file size
   */
  getFileSize(fileUrl: string, organizationId?: string): number {
    try {
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException("Unauthorized: File does not belong to your organization");
      }

      const storagePath = path.join(this.baseUploadDir, fileUrl.replace("/documents/", ""));
      const resolvedStoragePath = path.resolve(storagePath);

      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException("File not found");
      }

      const stats = fs.statSync(storagePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`Error getting file size: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to get file size: ${error.message}`);
    }
  }

  /**
   * List files in directory
   */
  listFiles(organizationId: string, folderType: string): string[] {
    try {
      const dirPath = path.join(this.baseUploadDir, "organizations", organizationId, folderType);
      const resolvedDirPath = path.resolve(dirPath);

      if (!this.validatePathSecurity(resolvedDirPath)) {
        throw new BadRequestException("Invalid directory path: Path traversal detected");
      }

      if (!fs.existsSync(dirPath)) {
        return [];
      }

      const files = fs.readdirSync(dirPath, { recursive: true });
      return files.map((file) => file.toString());
    } catch (error) {
      this.logger.error(`Error listing files: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get file information (size, dates)
   */
  getFileInfo(
    fileUrl: string,
    organizationId?: string,
  ): {
    size: number;
    createdAt: Date;
    modifiedAt: Date;
  } {
    try {
      if (organizationId && !fileUrl.includes(`/organizations/${organizationId}/`)) {
        throw new BadRequestException("Unauthorized: File does not belong to your organization");
      }

      const storagePath = path.join(this.baseUploadDir, fileUrl.replace("/documents/", ""));
      const resolvedStoragePath = path.resolve(storagePath);

      if (!this.validatePathSecurity(resolvedStoragePath)) {
        throw new BadRequestException("Invalid file path: Path traversal detected");
      }

      if (!fs.existsSync(storagePath)) {
        throw new BadRequestException("File not found");
      }

      const stats = fs.statSync(storagePath);
      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch (error) {
      this.logger.error(`Error getting file info: ${error.message}`);
      throw error instanceof BadRequestException ? error : new BadRequestException(`Failed to get file info: ${error.message}`);
    }
  }
}
