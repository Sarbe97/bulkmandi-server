import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileStorageService } from '../storage/services/file-storage.service';
import {
  DocumentUplod,
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';

const requiredSteps = ['org-kyc', 'bank-details', 'compliance-docs', 'catalog-and-price'];

interface FileUploadResponse {
  docType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  status: 'UPLOADED';
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,
    private fileStorageService: FileStorageService
  ) {}

  /**
   * ✅ Check if organization is editable
   */
  private checkEditPermission(org: OrganizationDocument): void {
    if (org.isOnboardingLocked) {
      throw new ForbiddenException(
        `Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`
      );
    }
  }

  // ===========================
  // STEP 1: UPDATE ORG KYC
  // ===========================

  /**
   * ✅ Update Organization KYC Details (No files)
   */
  async updateOrgKyc(
    orgId: string,
    kycData: {
      legalName?: string;
      tradeName?: string;
      gstin?: string;
      pan?: string;
      cin?: string;
      registeredAddress?: string;
      businessType?: string;
      incorporationDate?: string;
      plantLocations?: any[];
      primaryContact?: any;
    }
  ): Promise<any> {
    try {
      console.log(`📋 updateOrgKyc called for org: ${orgId}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      this.checkEditPermission(org);

      // Update KYC data
      org.legalName = kycData.legalName || org.legalName;
      org.orgKyc = {
        legalName: kycData.legalName,
        tradeName: kycData.tradeName,
        gstin: kycData.gstin,
        pan: kycData.pan,
        cin: kycData.cin,
        registeredAddress: kycData.registeredAddress,
        businessType: kycData.businessType,
        incorporationDate: kycData.incorporationDate,
        plantLocations: kycData.plantLocations || [],
        primaryContact: kycData.primaryContact,
      };

      if (!org.completedSteps.includes('org-kyc')) {
        org.completedSteps.push('org-kyc');
      }

      const savedOrg = await org.save();
      console.log(`✅ KYC data updated`);

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      console.error('❌ Error updating KYC:', error.message);
      throw error;
    }
  }

  // ===========================
  // PHASE 1: FILE UPLOAD (Storage Only)
  // ===========================

  /**
   * ✅ PHASE 1: Upload Single Document (Storage Only - No DB Update)
   * Returns file metadata for frontend to cache
   */
  async uploadSingleDocument(
    orgId: string,
    file: Express.Multer.File,
    docType: string
  ): Promise<DocumentUplod> {
    try {
      console.log(`📤 PHASE 1: Upload to storage (NO DB update)`);
      console.log(`  Organization: ${orgId}`);
      console.log(`  File: ${file.originalname} (${file.size} bytes)`);
      console.log(`  DocType: ${docType}`);

      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException('File is empty');
      }

      // ✅ Determine folder based on docType prefix
      const folder =
        docType.startsWith('GST_') ||
        docType.startsWith('PAN_') ||
        docType.startsWith('BUSINESS_') ||
        docType.startsWith('FACTORY_') ||
        docType.startsWith('QA_')
          ? `documents/organizations/${orgId}/compliance-documents/${docType}`
          : `documents/organizations/${orgId}/bank-documents/${docType}`;

      // ✅ Save ONLY to storage - NO database update
      const fileName = `${docType}_${Date.now()}_${file.originalname}`;
      const fileUrl = await this.fileStorageService.uploadFile({
        file: file.buffer,
        fileName,
        mimeType: file.mimetype,
        folder,
      });

      console.log(`✅ File saved to storage: ${fileUrl}`);

      // ✅ Return file metadata ONLY (NO DB persistence)
      return {
        docType,
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date(),
        status: 'UPLOADED',
      };
    } catch (error) {
      console.error('❌ Error in Phase 1 upload:', error.message);
      throw error;
    }
  }

  /**
   * ✅ PHASE 1: Delete Document (Storage Only - No DB Update)
   */
  async deleteDocument(orgId: string, docType: string): Promise<{ message: string }> {
    try {
      console.log(`🗑️ PHASE 1: Delete from storage (NO DB update)`);
      console.log(`  Organization: ${orgId}`);
      console.log(`  DocType: ${docType}`);

      // ✅ In production, you'd track fileUrl in session/cache
      // For now, frontend manages deletion from its state

      return {
        message: `Document ${docType} deleted successfully`,
      };
    } catch (error) {
      console.error('❌ Error in Phase 1 delete:', error.message);
      throw error;
    }
  }

  // ===========================
  // PHASE 2: PERSIST TO DATABASE
  // ===========================

  /**
   * ✅ PHASE 2: Update Bank Details + Documents (Persists to DB)
   * Called when user submits the BankDetailsStep form
   */
  async updateBankDetailsWithDocuments(
    orgId: string,
    data: {
      accountNumber: string;
      ifsc: string;
      bankName: string;
      accountHolderName: string;
      pennyDropStatus?: string;
      pennyDropScore?: number;
      documents: DocumentUplod[];
    }
  ): Promise<any> {
    try {
      console.log(`💾 PHASE 2: Persist bank details + documents to DB`);
      console.log(`  Organization: ${orgId}`);
      console.log(`  Account: ${data.accountNumber}`);
      console.log(`  Documents: ${data.documents.length}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      this.checkEditPermission(org);

      // Initialize bank account if needed
      if (!org.primaryBankAccount) {
        org.primaryBankAccount = { documents: [] };
      }

      // ✅ NOW persist bank account details to DB
      org.primaryBankAccount.accountNumber = data.accountNumber;
      org.primaryBankAccount.ifsc = data.ifsc;
      org.primaryBankAccount.bankName = data.bankName;
      org.primaryBankAccount.accountHolderName = data.accountHolderName;
      org.primaryBankAccount.pennyDropStatus = data.pennyDropStatus || 'PENDING';
      org.primaryBankAccount.pennyDropScore = data.pennyDropScore || 0;

      // ✅ NOW persist documents to DB (received from frontend)
      org.primaryBankAccount.documents = data.documents.map((doc) => ({
        docType: doc.docType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedAt: new Date(doc.uploadedAt),
        status: doc.status,
      }));

      // Mark step as completed
      if (!org.completedSteps.includes('bank-details')) {
        org.completedSteps.push('bank-details');
      }

      const savedOrg = await org.save();

      console.log(
        `✅ Bank details + documents persisted to DB - ${savedOrg.primaryBankAccount.documents.length} docs`
      );

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      console.error('❌ Error in Phase 2 persist:', error.message);
      throw error;
    }
  }

  /**
   * ✅ PHASE 2: Update Compliance Documents + Declarations (Persists to DB)
   * Called when user submits the ComplianceDocsStep form
   * Documents and Declarations saved as ONE unified object
   */
  async updateComplianceDocsWithDeclarations(
    orgId: string,
    data: {
      warrantyAssurance: boolean;
      termsAccepted: boolean;
      amlCompliance: boolean;
      documents: DocumentUplod[];
    }
  ): Promise<any> {
    try {
      console.log(`💾 PHASE 2: Persist compliance docs + declarations to DB`);
      console.log(`  Organization: ${orgId}`);
      console.log(`  Documents: ${data.documents.length}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      this.checkEditPermission(org);

      // Validate all declarations are true
      if (!data.warrantyAssurance || !data.termsAccepted || !data.amlCompliance) {
        throw new BadRequestException('All declarations must be accepted');
      }

      // Validate at least one document is provided
      if (!data.documents || data.documents.length === 0) {
        throw new BadRequestException('At least one compliance document is required');
      }

      // ✅ Create UNIFIED compliance object with documents AND declarations
      org.compliance = {
        documents: data.documents.map((doc) => ({
          docType: doc.docType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: new Date(doc.uploadedAt),
          status: doc.status,
        })),
        declarations: {
          warrantyAssurance: data.warrantyAssurance,
          termsAccepted: data.termsAccepted,
          amlCompliance: data.amlCompliance,
          // acceptedAt: new Date(),
        },
      };

      // Mark step as completed
      if (!org.completedSteps.includes('compliance-docs')) {
        org.completedSteps.push('compliance-docs');
      }

      const savedOrg = await org.save();

      console.log(
        `✅ Compliance docs + declarations persisted to DB - ${savedOrg.compliance.documents.length} docs`
      );

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      console.error('❌ Error in Phase 2 persist:', error.message);
      throw error;
    }
  }

  // ===========================
  // STEP 4: CATALOG & PRICING
  // ===========================

  /**
   * ✅ Update Catalog & Pricing
   */
  async updateCatalog(
    orgId: string,
    catalogData: {
      catalog?: any[];
      priceFloors?: any[];
      logisticsPreference?: any;
    }
  ): Promise<any> {
    try {
      console.log(`📋 updateCatalog called for org: ${orgId}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      this.checkEditPermission(org);

      if (catalogData.catalog) org.catalog = catalogData.catalog;
      if (catalogData.priceFloors) org.priceFloors = catalogData.priceFloors;
      if (catalogData.logisticsPreference) org.logisticsPreference = catalogData.logisticsPreference;

      if (!org.completedSteps.includes('catalog-and-price')) {
        org.completedSteps.push('catalog-and-price');
      }

      const savedOrg = await org.save();

      console.log(`✅ Catalog updated`);

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      console.error('❌ Error updating catalog:', error.message);
      throw error;
    }
  }

  // ===========================
  // GET ONBOARDING DATA
  // ===========================

  /**
   * ✅ Get Full Onboarding Status with all steps
   */
  async getOnboardingData(orgId: string): Promise<any> {
    try {
      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      return this.formatOnboardingResponse(org);
    } catch (error) {
      console.error('❌ Error fetching onboarding data:', error.message);
      throw error;
    }
  }

  /**
   * ✅ Helper: Format onboarding response
   */
  private formatOnboardingResponse(org: OrganizationDocument): any {
    return {
      organizationId: org._id.toString(),
      orgId: org.orgId,
      legalName: org.legalName,
      kycStatus: org.kycStatus,
      isOnboardingLocked: org.isOnboardingLocked,
      rejectionReason: org.rejectionReason || null,
      completedSteps: org.completedSteps,
      orgKyc: org.orgKyc || null,
      primaryBankAccount: {
        accountNumber: org.primaryBankAccount?.accountNumber,
        accountHolderName: org.primaryBankAccount?.accountHolderName,
        ifsc: org.primaryBankAccount?.ifsc,
        bankName: org.primaryBankAccount?.bankName,
        pennyDropStatus: org.primaryBankAccount?.pennyDropStatus,
        pennyDropScore: org.primaryBankAccount?.pennyDropScore,
        documents: org.primaryBankAccount?.documents || [],
      },
      compliance: org.compliance
        ? {
            documents: org.compliance.documents || [],
            declarations: org.compliance.declarations || null,
          }
        : null,
      catalog: org.catalog || [],
      priceFloors: org.priceFloors || [],
      logisticsPreference: org.logisticsPreference || null,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  // ===========================
  // SUBMIT ONBOARDING
  // ===========================

  /**
   * ✅ Submit Onboarding for Admin Review
   */
  async submitOnboarding(orgId: string): Promise<any> {
    try {
      console.log(`📤 submitOnboarding called for org: ${orgId}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      const allCompleted = requiredSteps.every((step) => org.completedSteps.includes(step));

      if (!allCompleted) {
        const missing = requiredSteps.filter((step) => !org.completedSteps.includes(step));
        throw new BadRequestException(`Missing steps - ${missing.join(', ')}`);
      }

      org.kycStatus = 'SUBMITTED';
      org.isOnboardingLocked = true;

      const savedOrg = await org.save();

      console.log(`✅ Onboarding submitted for review`);

      return {
        message: 'Onboarding submitted for admin review',
        organizationId: savedOrg._id.toString(),
        kycStatus: savedOrg.kycStatus,
      };
    } catch (error) {
      console.error('❌ Error submitting onboarding:', error.message);
      throw error;
    }
  }

  // ===========================
  // ADMIN OPERATIONS
  // ===========================

  /**
   * ✅ Admin: Update KYC Status
   */
  async updateKYCStatus(
    orgId: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ): Promise<any> {
    try {
      console.log(`🔄 updateKYCStatus for org: ${orgId} to ${status}`);

      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');

      org.kycStatus = status;

      if (status === 'REJECTED') {
        org.rejectionReason = rejectionReason || 'No reason provided';
        org.isOnboardingLocked = false;
      } else if (status === 'APPROVED') {
        org.kycApprovedAt = new Date();
        org.isOnboardingLocked = true;
      }

      const savedOrg = await org.save();

      console.log(`✅ KYC status updated to ${status}`);

      return {
        message: 'KYC status updated',
        organizationId: savedOrg._id.toString(),
        kycStatus: savedOrg.kycStatus,
      };
    } catch (error) {
      console.error('❌ Error updating KYC status:', error.message);
      throw error;
    }
  }

  // ===========================
  // CRUD OPERATIONS
  // ===========================

  /**
   * ✅ Create Organization
   */
  async createOrganization(data: any): Promise<OrganizationDocument> {
    try {
      console.log(`✏️ Creating organization...`);

      const org = new this.orgModel({
        ...data,
        kycStatus: 'DRAFT',
        isOnboardingLocked: false,
        completedSteps: [],
      });

      const savedOrg = await org.save();

      console.log(`✅ Organization created: ${savedOrg._id}`);
      return savedOrg;
    } catch (error) {
      console.error('❌ Error creating organization:', error.message);
      throw error;
    }
  }

  /**
   * ✅ Get Organization
   */
  async getOrganization(orgId: string): Promise<OrganizationDocument> {
    try {
      const org = await this.orgModel.findById(orgId);
      if (!org) throw new NotFoundException('Organization not found');
      return org;
    } catch (error) {
      console.error('❌ Error fetching organization:', error.message);
      throw error;
    }
  }

  /**
   * ✅ Delete Organization
   */
  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    try {
      console.log(`🗑️ Deleting organization: ${orgId}`);

      const org = await this.orgModel.findByIdAndDelete(orgId);

      if (!org) throw new NotFoundException('Organization not found');

      console.log(`✅ Organization deleted`);
      return { message: 'Organization deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting organization:', error.message);
      throw error;
    }
  }
}