import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import { KYCStatus } from "../kyc-status.constants";
import { KycCase, KycCaseDocument } from "../schemas/kyc.schema";
import { KycHelperService } from "./kyc.helper.service";

@Injectable()
export class KycAdminService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private readonly kycHelperService: KycHelperService,
    private readonly logger: CustomLoggerService,
  ) {}

  // create KYC case on submission
  async createKycCaseOnSubmission(orgId: string) {
    this.logger.log(`createKycCaseOnSubmission called for orgId: ${orgId}`);

    const org = await this.orgModel.findById(orgId);
    if (!org) {
      this.logger.warn(`Organization not found for createKycCaseOnSubmission, orgId: ${orgId}`);
      throw new NotFoundException("Organization not found");
    }

    const count = await this.kycCaseModel.countDocuments({ organizationId: orgId });
    this.logger.log(`Existing submissions count for orgId ${orgId}: ${count}`);

    const submissionAttempt = count + 1;
    const submissionNumber = `KYC-${orgId}-${String(submissionAttempt).padStart(3, "0")}`;
    this.logger.log(`Generated submissionNumber: ${submissionNumber}`);

    const kycCase = new this.kycCaseModel({
      organizationId: new Types.ObjectId(orgId),
      submissionNumber,
      status: KYCStatus.SUBMITTED,
      submittedData: {
        orgKyc: org.orgKyc,
        primaryBankAccount: org.primaryBankAccount,
        complianceDocuments: org.complianceDocuments,
        catalog: org.catalog,
        priceFloors: org.priceFloors,
        logisticsPreference: org.logisticsPreference,
      },
      submissionAttempt,
      activityLog: [
        {
          action: KYCStatus.SUBMITTED,
          timestamp: new Date(),
          performedBy: orgId,
          remarks: "Initial submission",
        },
      ],
    });

    this.logger.log(`Saving new KYC case for orgId: ${orgId}`);
    return kycCase.save();
  }

  /** Update an existing KYC case record with new data for resubmission */
  async updateKycCase(caseId: string): Promise<KycCaseDocument> {
    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) throw new NotFoundException("KYC case not found");

    // Get fresh updated data from organization
    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) throw new NotFoundException("Organization not found");

    kycCase.submittedData = {
      orgKyc: org.orgKyc,
      primaryBankAccount: org.primaryBankAccount,
      complianceDocuments: org.complianceDocuments,
      catalog: org.catalog,
      priceFloors: org.priceFloors,
      logisticsPreference: org.logisticsPreference,
    };

    kycCase.status = KYCStatus.SUBMITTED;
    kycCase.submittedAt = new Date();

    kycCase.activityLog.push({
      action: "RESUBMITTED",
      timestamp: new Date(),
      performedBy: kycCase.organizationId.toHexString(),
      remarks: "Resubmitted after info requested",
    });

    await kycCase.save();

    return kycCase;
  }

  /**
   * Get KYC verification queue with filters
   */
  async getKycQueue(filters?: { status?: string; role?: string; search?: string; page?: number; limit?: number }) {
    this.logger.log(`getKycQueue called with filters: ${JSON.stringify(filters)}`);

    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const matchStage: Record<string, any> = {};
    if (filters?.status && filters.status !== "ALL") {
      matchStage.status = filters.status;
      this.logger.log(`Filtering by status: ${filters.status}`);
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      // pick latest case per org
      {
        $group: {
          _id: "$organizationId",
          latestCaseId: { $first: "$_id" }, // most recent due to sort
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    this.logger.log(`Aggregation pipeline constructed: ${JSON.stringify(pipeline)}`);

    const groupedResults = await this.kycCaseModel.aggregate(pipeline).exec();
    this.logger.log(`Aggregated ${groupedResults.length} groups from pipeline`);

    const latestCaseIds = groupedResults.map((g) => g.latestCaseId);

    let cases = await this.kycCaseModel
      .find({ _id: { $in: latestCaseIds } })
      .populate("organizationId")
      .lean()
      .exec();
    this.logger.log(`Fetched ${cases.length} KYC cases from database`);

    // role filter if required
    if (filters?.role && filters.role !== "ALL") {
      cases = cases.filter((c) => (c.organizationId as any)?.role === filters.role);
      this.logger.log(`Filtered cases by role: ${filters.role}, remaining count: ${cases.length}`);
    }

    // search filter if required
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      cases = cases.filter((c) => (c.organizationId as any)?.legalName?.toLowerCase().includes(searchLower));
      this.logger.log(`Filtered cases by search term: ${filters.search}, remaining count: ${cases.length}`);
    }

    const totalOrgs = await this.orgModel.countDocuments(filters?.role && filters.role !== "ALL" ? { role: filters.role } : {});
    this.logger.log(`Total organizations count for filters: ${totalOrgs}`);

    const items = cases.map((kycCase) => {
      const org = kycCase.organizationId as any;

      return {
        caseId: kycCase._id.toString(),
        submissionNumber: kycCase.submissionNumber,
        organizationId: org._id.toString(),
        orgName: org.legalName,
        role: org.role,
        gstin: org.orgKyc?.gstin || "N/A",
        pan: org.orgKyc?.pan || "N/A",
        bankVerified: org.primaryBankAccount?.pennyDropStatus === "VERIFIED",
        bankScore: org.primaryBankAccount?.pennyDropScore || 0,
        riskLevel: "Low",
        riskRemarks: "",
        submittedAt: kycCase.createdAt,
        age: this.kycHelperService.calculateAge(kycCase.createdAt),
      };
    });

    this.logger.log(`Returning ${items.length} KYC queue items`);

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalOrgs,
        totalPages: Math.ceil(totalOrgs / limit),
      },
    };
  }

  async getKycCaseDetail(caseId: string) {
    this.logger.log(`getKycCaseDetail called with caseId: ${caseId}`);

    const kycCase = await this.kycCaseModel.findById(caseId).populate("organizationId").lean();
    if (!kycCase) {
      this.logger.warn(`KYC case not found for caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    const org = kycCase.organizationId as any;

    const autoChecks = {
      gstinValid: this.kycHelperService.validateGSTIN(org.orgKyc?.gstin),
      panValid: this.kycHelperService.validatePAN(org.orgKyc?.pan),
      bankAccountValid: org.primaryBankAccount?.pennyDropStatus === "VERIFIED",
      documentsComplete: this.kycHelperService.checkDocumentsComplete(org),
      addressVerified: !!org.orgKyc?.registeredAddress,
    };

    this.logger.log(`Auto checks completed for caseId: ${caseId}`);

    const riskAssessment = this.kycHelperService.assessRisk(org);

    this.logger.log(`Risk assessment done for caseId: ${caseId}, level: ${riskAssessment.level}`);

    return {
      case: {
        caseId: kycCase._id,
        submissionNumber: kycCase.submissionNumber,
        status: kycCase.status,
        submittedAt: kycCase.createdAt,
        age: this.kycHelperService.calculateAge(kycCase.createdAt),
        sla: {
          tat: "24h",
          age: this.kycHelperService.calculateAge(kycCase.createdAt),
        },
      },
      organization: {
        id: org._id,
        orgId: org.orgId,
        legalName: org.legalName,
        tradeName: org.orgKyc?.tradeName,
        role: org.role,
        gstin: org.orgKyc?.gstin,
        pan: org.orgKyc?.pan,
        cin: org.orgKyc?.cin,
        registeredAddress: org.orgKyc?.registeredAddress,
        businessType: org.orgKyc?.businessType,
        incorporationDate: org.orgKyc?.incorporationDate,
      },
      contacts: {
        primary: org.orgKyc?.primaryContact,
        secondary: org.orgKyc?.secondaryContact,
      },
      plantLocations: org.orgKyc?.plantLocations || [],
      bankAccount: {
        accountNumber: org.primaryBankAccount?.accountNumber,
        ifsc: org.primaryBankAccount?.ifsc,
        bankName: org.primaryBankAccount?.bankName,
        accountHolderName: org.primaryBankAccount?.accountHolderName,
        accountType: org.primaryBankAccount?.accountType,
        pennyDropStatus: org.primaryBankAccount?.pennyDropStatus,
        pennyDropScore: org.primaryBankAccount?.pennyDropScore,
        documents: org.primaryBankAccount?.documents || [],
      },
      complianceDocuments: org.complianceDocuments || [],
      catalog: org.catalog || [],
      priceFloors: org.priceFloors || [],
      logisticsPreference: org.logisticsPreference,
      autoChecks,
      riskAssessment,
      activityLog: kycCase.activityLog || [],
    };
  }

  /**
   * Approve KYC case
   */
  async approveKycCase(caseId: string, adminId: string, remarks?: string) {
    this.logger.log(`approveKycCase called for caseId: ${caseId} by admin: ${adminId}`);

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      this.logger.warn(`KYC case not found for approval, caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    if (kycCase.status !== KYCStatus.SUBMITTED) {
      this.logger.warn(`Attempt to approve KYC case with invalid status: ${kycCase.status}`);
      throw new BadRequestException("Only submitted cases can be approved");
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      this.logger.warn(`Organization not found for caseId: ${caseId}`);
      throw new NotFoundException("Organization not found");
    }

    kycCase.status = KYCStatus.APPROVED;
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: "APPROVED",
      timestamp: new Date(),
      performedBy: adminId,
      remarks: remarks || "KYC approved by admin",
    });
    await kycCase.save();
    this.logger.log(`KYC case approved and saved, caseId: ${caseId}`);

    org.kycStatus = "APPROVED";
    org.isVerified = true;
    org.isOnboardingLocked = true;
    org.kycApprovedAt = new Date();
    org.kycApprovedBy = adminId;
    org.rejectionReason = undefined; // Clear any previous rejection
    await org.save();
    this.logger.log(`Organization updated after KYC approval, orgId: ${org._id}`);

    return {
      message: "KYC case approved successfully",
      kycCase: {
        id: kycCase._id,
        status: kycCase.status,
        reviewedAt: kycCase.reviewedAt,
      },
      organization: {
        id: org._id,
        kycStatus: org.kycStatus,
        isVerified: org.isVerified,
      },
    };
  }

  /**
   * Reject KYC case
   */
  async rejectKycCase(caseId: string, adminId: string, rejectionReason: string) {
    this.logger.log(`rejectKycCase called for caseId: ${caseId} by admin: ${adminId}`);

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      this.logger.warn("Rejection reason missing");
      throw new BadRequestException("Rejection reason is required");
    }

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      this.logger.warn(`KYC case not found for rejection, caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    if (kycCase.status !== KYCStatus.SUBMITTED) {
      this.logger.warn(`Attempt to reject KYC case with invalid status: ${kycCase.status}`);
      throw new BadRequestException("Only submitted cases can be rejected");
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      this.logger.warn(`Organization not found for caseId: ${caseId}`);
      throw new NotFoundException("Organization not found");
    }

    kycCase.status = KYCStatus.REJECTED;
    kycCase.rejectionReason = rejectionReason;
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: "REJECTED",
      timestamp: new Date(),
      performedBy: adminId,
      remarks: rejectionReason,
    });
    await kycCase.save();
    this.logger.log(`KYC case rejected and saved, caseId: ${caseId}`);

    org.kycStatus = "REJECTED";
    org.rejectionReason = rejectionReason;
    org.isOnboardingLocked = false;
    org.isVerified = false;
    await org.save();
    this.logger.log(`Organization updated after KYC rejection, orgId: ${org._id}`);

    return {
      message: "KYC case rejected successfully",
      kycCase: {
        id: kycCase._id,
        status: kycCase.status,
        rejectionReason: kycCase.rejectionReason,
        reviewedAt: kycCase.reviewedAt,
      },
      organization: {
        id: org._id,
        kycStatus: org.kycStatus,
        rejectionReason: org.rejectionReason,
      },
    };
  }

  async unlockForUpdate(caseId: string, adminId: string, remarks: string) {
    this.logger.log(`unlockForUpdate called for caseId: ${caseId} by admin: ${adminId}`);

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      this.logger.warn(`KYC case not found for unlocking, caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      this.logger.warn(`Organization not found for unlocking, caseId: ${caseId}`);
      throw new NotFoundException("Organization not found");
    }

    if (org.kycStatus !== KYCStatus.APPROVED) {
      this.logger.warn(`Cannot unlock KYC with status: ${org.kycStatus}`);
      throw new BadRequestException("Can only unlock approved KYC");
    }

    kycCase.activityLog.push({
      action: KYCStatus.REVISION_REQUESTED,
      timestamp: new Date(),
      performedBy: adminId,
      remarks: remarks || "Revision Requested by admin",
    });
    await kycCase.save();
    this.logger.log(`KYC case unlocked for update, caseId: ${caseId}`);

    org.isOnboardingLocked = false;
    org.kycStatus = KYCStatus.REVISION_REQUESTED;
    await org.save();
    this.logger.log(`Organization status updated to REVISION_REQUESTED, orgId: ${org._id}`);

    return {
      message: "Organization unlocked for updates",
      organizationId: org._id,
      kycStatus: org.kycStatus,
    };
  }

  /**
   * Request more information
   */
  async requestMoreInfo(caseId: string, adminId: string, message: string, fields: string[]) {
    this.logger.log(`requestMoreInfo called for caseId: ${caseId} by admin: ${adminId} with fields: ${fields.join(", ")}`);

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      this.logger.warn(`KYC case not found for info request, caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      this.logger.warn(`Organization not found for info request, caseId: ${caseId}`);
      throw new NotFoundException("Organization not found");
    }

    kycCase.status = KYCStatus.INFO_REQUESTED;
    kycCase.activityLog.push({
      action: KYCStatus.INFO_REQUESTED,
      timestamp: new Date(),
      performedBy: adminId,
      remarks: `Fields: ${fields.join(", ")}. Message: ${message}`,
    });
    await kycCase.save();
    this.logger.log(`Information requested saved for caseId: ${caseId}`);

    org.isOnboardingLocked = false;
    org.kycStatus = KYCStatus.INFO_REQUESTED;
    await org.save();
    this.logger.log(`Organization unlocked after info request, orgId: ${org._id}`);

    return {
      message: "Information request sent to seller",
      requestedFields: fields,
      adminMessage: message,
    };
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(caseId: string, adminId: string, reason: string, tags: string[]) {
    this.logger.log(`addToWatchlist called for caseId: ${caseId} by admin: ${adminId}`);

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      this.logger.warn(`KYC case not found for watchlist addition, caseId: ${caseId}`);
      throw new NotFoundException("KYC case not found");
    }

    kycCase.activityLog.push({
      action: "ADDED_TO_WATCHLIST",
      timestamp: new Date(),
      performedBy: adminId,
      remarks: `Reason: ${reason}. Tags: ${tags.join(", ")}`,
    });
    await kycCase.save();

    this.logger.log(`KYC case added to watchlist, caseId: ${caseId}`);

    return {
      message: "Organization added to watchlist",
      reason,
      tags,
    };
  }

  /**
   * Get KYC case history - already logged internally
   */
  async getKycCaseHistory(orgId: string) {
    this.logger.log(`getKycCaseHistory called for orgId: ${orgId}`);

    const orgObjId = new Types.ObjectId(orgId);

    const cases = await this.kycCaseModel
      .find({ organizationId: orgObjId })
      .sort({ createdAt: -1 }) // newest first
      .lean();

    return cases.map((c) => ({
      caseId: c._id.toString(),
      submissionNumber: c.submissionNumber,
      status: c.status,
      submissionAttempt: c.submissionAttempt,
      submittedAt: c.createdAt,
      reviewedAt: c.reviewedAt,
      rejectionReason: c.rejectionReason,
    }));
  }

  async getLatestKycCase(organizationId: string): Promise<KycCaseDocument | null> {
    return this.kycCaseModel
      .findOne({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ submissionAttempt: -1 })
      .exec();
  }
}
