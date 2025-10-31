import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../../organizations/schemas/organization.schema';
import { KycCase, KycCaseDocument } from '../schemas/kyc.schema';

@Injectable()
export class KycAdminService {
  constructor(
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) {}

  /**
   * Get KYC verification queue with filters
   */
  async getKycQueue(filters?: {
    status?: string;
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    if (filters?.status) {
      query.status = filters.status;
    } else {
      query.status = 'SUBMITTED';
    }

    const cases = await this.kycCaseModel
      .find(query)
      .populate('organizationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let filteredCases = cases;
    if (filters?.role) {
      filteredCases = cases.filter(c => (c.organizationId as any)?.role === filters.role);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredCases = filteredCases.filter(c => 
        (c.organizationId as any)?.legalName?.toLowerCase().includes(searchLower)
      );
    }

    const total = await this.kycCaseModel.countDocuments(query);

    const items = filteredCases.map(kycCase => {
      const org = kycCase.organizationId as any;
      const riskAssessment = this.assessRisk(org);
      
      return {
        caseId: kycCase._id,
        submissionNumber: kycCase.submissionNumber,
        organizationId: org._id,
        orgName: org.legalName,
        role: org.role,
        gstin: org.orgKyc?.gstin || 'N/A',
        pan: org.orgKyc?.pan || 'N/A',
        bankVerified: org.primaryBankAccount?.pennyDropStatus === 'VERIFIED',
        bankScore: org.primaryBankAccount?.pennyDropScore || 0,
        riskLevel: riskAssessment.level,
        riskRemarks: riskAssessment.remarks,
        submittedAt: kycCase.createdAt,
        age: this.calculateAge(kycCase.createdAt),
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed KYC case information
   */
  async getKycCaseDetail(caseId: string) {
    const kycCase = await this.kycCaseModel
      .findById(caseId)
      .populate('organizationId')
      .lean();

    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    const org = kycCase.organizationId as any;

    const autoChecks = {
      gstinValid: this.validateGSTIN(org.orgKyc?.gstin),
      panValid: this.validatePAN(org.orgKyc?.pan),
      bankAccountValid: org.primaryBankAccount?.pennyDropStatus === 'VERIFIED',
      documentsComplete: this.checkDocumentsComplete(org),
      addressVerified: !!org.orgKyc?.registeredAddress,
    };

    const riskAssessment = this.assessRisk(org);

    return {
      case: {
        caseId: kycCase._id,
        submissionNumber: kycCase.submissionNumber,
        status: kycCase.status,
        submittedAt: kycCase.createdAt,
        age: this.calculateAge(kycCase.createdAt),
        sla: {
          tat: '24h',
          age: this.calculateAge(kycCase.createdAt),
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
    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    if (kycCase.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted cases can be approved');
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    kycCase.status = 'APPROVED';
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: 'APPROVED',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: remarks || 'KYC approved by admin',
    });
    await kycCase.save();

    org.kycStatus = 'APPROVED';
    org.isVerified = true;
    org.isOnboardingLocked = true;
    org.kycApprovedAt = new Date();
    org.kycApprovedBy = adminId;
    org.rejectionReason = undefined; // Clear any previous rejection
    await org.save();

    return {
      message: 'KYC case approved successfully',
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
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    if (kycCase.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted cases can be rejected');
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    kycCase.status = 'REJECTED';
    kycCase.rejectionReason = rejectionReason;
    kycCase.reviewedBy = adminId;
    kycCase.reviewedAt = new Date();
    kycCase.activityLog.push({
      action: 'REJECTED',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: rejectionReason,
    });
    await kycCase.save();

    // FIXED: Use rejectionReason instead of kycRejectionReason
    org.kycStatus = 'REJECTED';
    org.rejectionReason = rejectionReason;
    org.isOnboardingLocked = false;
    org.isVerified = false;
    await org.save();

    return {
      message: 'KYC case rejected successfully',
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

  /**
   * Request more information
   */
  async requestMoreInfo(caseId: string, adminId: string, message: string, fields: string[]) {
    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    const org = await this.orgModel.findById(kycCase.organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    kycCase.status = 'INFO_REQUESTED';
    kycCase.activityLog.push({
      action: 'INFO_REQUESTED',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: `Fields: ${fields.join(', ')}. Message: ${message}`,
    });
    await kycCase.save();

    org.isOnboardingLocked = false;
    await org.save();

    return {
      message: 'Information request sent to seller',
      requestedFields: fields,
      adminMessage: message,
    };
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(caseId: string, adminId: string, reason: string, tags: string[]) {
    const kycCase = await this.kycCaseModel.findById(caseId);
    if (!kycCase) {
      throw new NotFoundException('KYC case not found');
    }

    kycCase.activityLog.push({
      action: 'ADDED_TO_WATCHLIST',
      timestamp: new Date(),
      performedBy: adminId,
      remarks: `Reason: ${reason}. Tags: ${tags.join(', ')}`,
    });
    await kycCase.save();

    return {
      message: 'Organization added to watchlist',
      reason,
      tags,
    };
  }

  /**
   * Get KYC history
   */
  async getKycCaseHistory(orgId: string) {
    const cases = await this.kycCaseModel
      .find({ organizationId: orgId })
      .sort({ submissionAttempt: -1 })
      .lean();

    return cases.map(c => ({
      caseId: c._id,
      submissionNumber: c.submissionNumber,
      status: c.status,
      submissionAttempt: c.submissionAttempt,
      submittedAt: c.createdAt,
      reviewedAt: c.reviewedAt,
      rejectionReason: c.rejectionReason,
    }));
  }

  // ========== HELPER METHODS ==========

  /**
   * Comprehensive risk assessment
   * Purpose: Evaluate multiple risk factors, not just penny drop
   */
  private assessRisk(org: any): { level: string; score: number; remarks: string } {
    let riskScore = 100; // Start with perfect score
    const issues: string[] = [];

    // 1. Bank verification (most critical - 40 points)
    const pennyDropStatus = org.primaryBankAccount?.pennyDropStatus;
    const pennyDropScore = org.primaryBankAccount?.pennyDropScore || 0;
    
    if (pennyDropStatus === 'FAILED' || !pennyDropStatus) {
      riskScore -= 40;
      issues.push('Bank verification failed');
    } else if (pennyDropScore < 95) {
      riskScore -= Math.floor((100 - pennyDropScore) / 2.5); // Partial deduction
      issues.push('Bank name mismatch detected');
    }

    // 2. Document completeness (20 points)
    if (!this.checkDocumentsComplete(org)) {
      riskScore -= 20;
      issues.push('Missing required documents');
    }

    // 3. GSTIN validation (15 points)
    if (!this.validateGSTIN(org.orgKyc?.gstin)) {
      riskScore -= 15;
      issues.push('Invalid GSTIN format');
    }

    // 4. PAN validation (15 points)
    if (!this.validatePAN(org.orgKyc?.pan)) {
      riskScore -= 15;
      issues.push('Invalid PAN format');
    }

    // 5. Address verification (10 points)
    if (!org.orgKyc?.registeredAddress || org.orgKyc.registeredAddress.length < 20) {
      riskScore -= 10;
      issues.push('Incomplete address');
    }

    // Calculate final level
    let level: string;
    if (riskScore >= 85) level = 'Low';
    else if (riskScore >= 65) level = 'Medium';
    else level = 'High';

    const remarks = issues.length > 0 ? issues.join('; ') : 'All checks passed';

    return { level, score: riskScore, remarks };
  }

  /**
   * Calculate age of KYC submission
   * Purpose: Track SLA (Service Level Agreement) - must process within 24h
   */
  private calculateAge(submittedAt?: Date): string {
    if (!submittedAt) return '00:00';
    
    const now = new Date();
    const diff = now.getTime() - new Date(submittedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private validateGSTIN(gstin?: string): boolean {
    if (!gstin) return false;
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  }

  private validatePAN(pan?: string): boolean {
    if (!pan) return false;
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  private checkDocumentsComplete(org: any): boolean {
    const requiredDocs = ['GST_CERTIFICATE', 'PAN_CERTIFICATE'];
    const uploadedTypes = (org.complianceDocuments || []).map((d: any) => d.type);
    return requiredDocs.every(type => uploadedTypes.includes(type));
  }
}
