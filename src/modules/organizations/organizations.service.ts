import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { KycCaseService } from "../kyc/services/kyc.service";
import { FileStorageService } from "../storage/services/file-storage.service";
import { DocumentUplod, Organization, OrganizationDocument } from "./schemas/organization.schema";

const requiredSteps = ["org-kyc", "bank-details", "compliance-docs", "catalog-and-price"];

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,

    private kycCaseService: KycCaseService,
    private fileStorageService: FileStorageService,
    private readonly logger: CustomLoggerService, // add this
  ) {}

  private checkEditPermission(org: OrganizationDocument): void {
    if (org.isOnboardingLocked) {
      this.logger.log(`Forbidden edit attempt. Onboarding locked with status: ${org.kycStatus}`, "checkEditPermission");
      throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`);
    }
  }

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
    },
  ): Promise<any> {
    try {
      this.logger.log(`Called updateOrgKyc for org: ${orgId}`, "updateOrgKyc");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "updateOrgKyc");
        throw new NotFoundException("Organization not found");
      }

      this.checkEditPermission(org);

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

      if (!org.completedSteps.includes("org-kyc")) {
        org.completedSteps.push("org-kyc");
      }

      const savedOrg = await org.save();
      this.logger.log(`KYC data updated successfully for org: ${orgId}`, "updateOrgKyc");

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      this.logger.log(`Error updating KYC for org ${orgId}: ${error.message}`, "updateOrgKyc");
      throw error;
    }
  }

  async uploadSingleDocument(orgId: string, file: Express.Multer.File, docType: string): Promise<DocumentUplod> {
    try {
      this.logger.log(`Phase 1: Upload to storage (no DB) for org: ${orgId}`, "uploadSingleDocument");
      this.logger.log(`File: ${file.originalname} (${file.size} bytes), DocType: ${docType}`, "uploadSingleDocument");

      if (!file.buffer || file.buffer.length === 0) {
        this.logger.log(`File is empty in uploadSingleDocument for org: ${orgId}`, "uploadSingleDocument");
        throw new BadRequestException("File is empty");
      }

      const folder = `documents/organizations/${orgId}`;
      const fileName = `${docType}_${Date.now()}_${file.originalname}`;
      const fileUrl = await this.fileStorageService.uploadFile({
        file: file.buffer,
        fileName,
        mimeType: file.mimetype,
        folder,
      });

      this.logger.log(`File saved to storage: ${fileUrl}`, "uploadSingleDocument");

      return {
        docType,
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date(),
        status: "UPLOADED",
      };
    } catch (error) {
      this.logger.log(`Error in Phase 1 upload for org ${orgId}: ${error.message}`, "uploadSingleDocument");
      throw error;
    }
  }

  async deleteDocument(orgId: string, docType: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Phase 1: Delete from storage (no DB) for org: ${orgId}`, "deleteDocument");
      this.logger.log(`DocType: ${docType}`, "deleteDocument");

      return {
        message: `Document ${docType} deleted successfully`,
      };
    } catch (error) {
      this.logger.log(`Error in Phase 1 delete for org ${orgId}: ${error.message}`, "deleteDocument");
      throw error;
    }
  }

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
    },
  ): Promise<any> {
    try {
      this.logger.log(`Phase 2: Persist bank details + documents for org: ${orgId}`, "updateBankDetailsWithDocuments");
      this.logger.log(`Account: ${data.accountNumber}, Documents count: ${data.documents.length}`, "updateBankDetailsWithDocuments");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "updateBankDetailsWithDocuments");
        throw new NotFoundException("Organization not found");
      }

      this.checkEditPermission(org);

      if (!org.primaryBankAccount) {
        org.primaryBankAccount = { documents: [] };
      }

      org.primaryBankAccount.accountNumber = data.accountNumber;
      org.primaryBankAccount.ifsc = data.ifsc;
      org.primaryBankAccount.bankName = data.bankName;
      org.primaryBankAccount.accountHolderName = data.accountHolderName;
      org.primaryBankAccount.pennyDropStatus = data.pennyDropStatus || "PENDING";
      org.primaryBankAccount.pennyDropScore = data.pennyDropScore || 0;

      org.primaryBankAccount.documents = data.documents.map((doc) => ({
        docType: doc.docType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedAt: new Date(doc.uploadedAt),
        status: doc.status,
      }));

      if (!org.completedSteps.includes("bank-details")) {
        org.completedSteps.push("bank-details");
      }

      const savedOrg = await org.save();

      this.logger.log(
        `Bank details + documents persisted - ${savedOrg.primaryBankAccount.documents.length} docs for org: ${orgId}`,
        "updateBankDetailsWithDocuments",
      );

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      this.logger.log(`Error in Phase 2 persist bank details for org ${orgId}: ${error.message}`, "updateBankDetailsWithDocuments");
      throw error;
    }
  }

  async updateComplianceDocsWithDeclarations(
    orgId: string,
    data: {
      warrantyAssurance: boolean;
      termsAccepted: boolean;
      amlCompliance: boolean;
      documents: DocumentUplod[];
    },
  ): Promise<any> {
    try {
      this.logger.log(`Phase 2: Persist compliance docs + declarations for org: ${orgId}`, "updateComplianceDocsWithDeclarations");
      this.logger.log(`Documents count: ${data.documents.length}`, "updateComplianceDocsWithDeclarations");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "updateComplianceDocsWithDeclarations");
        throw new NotFoundException("Organization not found");
      }

      this.checkEditPermission(org);

      if (!data.warrantyAssurance || !data.termsAccepted || !data.amlCompliance) {
        this.logger.log(`Declarations not accepted for org: ${orgId}`, "updateComplianceDocsWithDeclarations");
        throw new BadRequestException("All declarations must be accepted");
      }

      if (!data.documents || data.documents.length === 0) {
        this.logger.log(`No compliance documents provided for org: ${orgId}`, "updateComplianceDocsWithDeclarations");
        throw new BadRequestException("At least one compliance document is required");
      }

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
        },
      };

      if (!org.completedSteps.includes("compliance-docs")) {
        org.completedSteps.push("compliance-docs");
      }

      const savedOrg = await org.save();

      this.logger.log(
        `Compliance docs + declarations persisted - ${savedOrg.compliance.documents.length} docs for org: ${orgId}`,
        "updateComplianceDocsWithDeclarations",
      );

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      this.logger.log(`Error persisting compliance docs for org ${orgId}: ${error.message}`, "updateComplianceDocsWithDeclarations");
      throw error;
    }
  }

  async updateCatalog(
    orgId: string,
    catalogData: {
      catalog?: any[];
      priceFloors?: any[];
      logisticsPreference?: any;
    },
  ): Promise<any> {
    try {
      this.logger.log(`Called updateCatalog for org: ${orgId}`, "updateCatalog");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "updateCatalog");
        throw new NotFoundException("Organization not found");
      }

      this.checkEditPermission(org);

      if (catalogData.catalog) org.catalog = catalogData.catalog;
      if (catalogData.priceFloors) org.priceFloors = catalogData.priceFloors;
      if (catalogData.logisticsPreference) org.logisticsPreference = catalogData.logisticsPreference;

      if (!org.completedSteps.includes("catalog-and-price")) {
        org.completedSteps.push("catalog-and-price");
      }

      const savedOrg = await org.save();

      this.logger.log(`Catalog updated for org: ${orgId}`, "updateCatalog");

      return this.formatOnboardingResponse(savedOrg);
    } catch (error) {
      this.logger.log(`Error updating catalog for org ${orgId}: ${error.message}`, "updateCatalog");
      throw error;
    }
  }

  async getOnboardingData(orgId: string): Promise<any> {
    try {
      this.logger.log(`Fetching onboarding data for org: ${orgId}`, "getOnboardingData");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "getOnboardingData");
        throw new NotFoundException("Organization not found");
      }

      return this.formatOnboardingResponse(org);
    } catch (error) {
      this.logger.log(`Error fetching onboarding data for org ${orgId}: ${error.message}`, "getOnboardingData");
      throw error;
    }
  }

  private formatOnboardingResponse(org: OrganizationDocument): any {
    // Assuming no asynchronous operations here, so no logging needed
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

  async submitOnboarding(orgId: string): Promise<any> {
    try {
      this.logger.log(`Called submitOnboarding for org: ${orgId}`, "submitOnboarding");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "submitOnboarding");
        throw new NotFoundException("Organization not found");
      }

      const allCompleted = requiredSteps.every((step) => org.completedSteps.includes(step));

      if (!allCompleted) {
        const missing = requiredSteps.filter((step) => !org.completedSteps.includes(step));
        this.logger.log(`Missing onboarding steps for org ${orgId}: ${missing.join(", ")}`, "submitOnboarding");
        throw new BadRequestException(`Missing steps - ${missing.join(", ")}`);
      }

      // CREATE NEW KYC CASE (with snapshot and attempt increment)
      const kycCase = await this.kycCaseService.createKycCaseOnSubmission(orgId);

      org.kycStatus = "SUBMITTED";
      org.isOnboardingLocked = true;

      const savedOrg = await org.save();

      this.logger.log(`Onboarding submitted for review for org: ${orgId}`, "submitOnboarding");

      return {
        message: "Onboarding submitted for admin review",
        organizationId: savedOrg._id.toString(),
        kycStatus: savedOrg.kycStatus,
      };
    } catch (error) {
      this.logger.log(`Error submitting onboarding for org ${orgId}: ${error.message}`, "submitOnboarding");
      throw error;
    }
  }

  async updateKYCStatus(orgId: string, status: "APPROVED" | "REJECTED", rejectionReason?: string): Promise<any> {
    try {
      this.logger.log(`Updating KYC status for org ${orgId} to ${status}`, "updateKYCStatus");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "updateKYCStatus");
        throw new NotFoundException("Organization not found");
      }

      org.kycStatus = status;

      if (status === "REJECTED") {
        org.rejectionReason = rejectionReason || "No reason provided";
        org.isOnboardingLocked = false;
      } else if (status === "APPROVED") {
        org.kycApprovedAt = new Date();
        org.isOnboardingLocked = true;
      }

      const savedOrg = await org.save();

      this.logger.log(`KYC status updated to ${status} for org: ${orgId}`, "updateKYCStatus");

      return {
        message: "KYC status updated",
        organizationId: savedOrg._id.toString(),
        kycStatus: savedOrg.kycStatus,
      };
    } catch (error) {
      this.logger.log(`Error updating KYC status for org ${orgId}: ${error.message}`, "updateKYCStatus");
      throw error;
    }
  }

  async createOrganization(data: any): Promise<OrganizationDocument> {
    try {
      this.logger.log("Creating organization", "createOrganization");

      const org = new this.orgModel({
        ...data,
        kycStatus: "DRAFT",
        isOnboardingLocked: false,
        completedSteps: [],
      });

      const savedOrg = await org.save();

      this.logger.log(`Organization created with id ${savedOrg._id}`, "createOrganization");
      return savedOrg;
    } catch (error) {
      this.logger.log(`Error creating organization: ${error.message}`, "createOrganization");
      throw error;
    }
  }

  async getOrganization(orgId: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization with id ${orgId}`, "getOrganization");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "getOrganization");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization ${orgId}: ${error.message}`, "getOrganization");
      throw error;
    }
  }

  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting organization with id ${orgId}`, "deleteOrganization");

      const org = await this.orgModel.findByIdAndDelete(orgId);

      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "deleteOrganization");
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Organization deleted with id ${orgId}`, "deleteOrganization");
      return { message: "Organization deleted successfully" };
    } catch (error) {
      this.logger.log(`Error deleting organization ${orgId}: ${error.message}`, "deleteOrganization");
      throw error;
    }
  }

  // organizations.service.ts
  async requestKycUpdate(orgId: string, data: { reason: string }): Promise<any> {
    this.logger.log(`Called requestKycUpdate for org ${orgId}`, "requestKycUpdate");

    // ✅ VALIDATION STEP 1: Organization exists
    const org = await this.orgModel.findById(orgId);
    if (!org) {
      this.logger.log(`Organization not found for orgId ${orgId}`, "requestKycUpdate");
      throw new NotFoundException("Organization not found");
    }

    // ✅ VALIDATION STEP 2: KYC must be APPROVED to request update
    if (org.kycStatus !== "APPROVED") {
      this.logger.log(`Invalid KYC status ${org.kycStatus} for org ${orgId}. Must be APPROVED`, "requestKycUpdate");
      throw new BadRequestException(`Cannot request update. Current KYC status is ${org.kycStatus}. Only APPROVED KYC can be updated.`);
    }
    org.kycStatus = "UPDATE_IN_PROGRESS";
    org.isOnboardingLocked = false;
    org.updateRequestedAt = new Date();
    org.updateReason = data.reason;

    await org.save();

    // ✅ RESPONSE: Return success with request details
    return {
      message: "Update request sent. You can now edit and resubmit.",
      kycStatus: "UPDATE_IN_PROGRESS",
      isOnboardingLocked: false,
    };
  }
}
