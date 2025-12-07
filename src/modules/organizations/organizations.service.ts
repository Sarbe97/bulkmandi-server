import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { Organization, OrganizationDocument } from "./schemas/organization.schema";
import { UserRole } from "@common/enums";

/**
 * OrganizationsService
 *
 * Handles generic organization concerns only.
 * Seller-specific onboarding logic has been moved to SellerService.
 * Buyer-specific onboarding logic is in BuyerService.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,
    private readonly logger: CustomLoggerService,
    private readonly idGenerator: IdGeneratorService, // ✅ Inject ID generator
  ) { }

  /**
   * Create a new organization
   */
  async createOrganization(data: any): Promise<OrganizationDocument> {
    try {
      this.logger.log("Creating organization", "OrganizationsService.createOrganization");

      // ✅ Generate unique orgCode based on name
      const orgCode = await this.idGenerator.generateOrgCode(data.legalName);

      const org = new this.orgModel({
        ...data,
        orgCode, // ✅ Set generated orgCode
        orgId: orgCode, // ✅ Set orgId alias
        kycStatus: "DRAFT",
        isOnboardingLocked: false,
        completedSteps: [],
      });

      const savedOrg = await org.save();

      this.logger.log(
        `Organization created with orgCode ${savedOrg.orgCode} (_id: ${savedOrg._id})`,
        "OrganizationsService.createOrganization"
      );

      return savedOrg;
    } catch (error) {
      this.logger.log(`Error creating organization: ${error.message}`, "OrganizationsService.createOrganization");
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization with id ${orgId}`, "OrganizationsService.getOrganization");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.getOrganization");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization ${orgId}: ${error.message}`, "OrganizationsService.getOrganization");
      throw error;
    }
  }

  /**
   * Get organization by OrganizationId (orgId field)
   */
  async getOrganizationByOrgId(orgId: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization by orgId: ${orgId}`, "OrganizationsService.getOrganizationByOrgId");

      const org = await this.orgModel.findOne({ orgId });
      if (!org) {
        this.logger.log(`Organization not found with orgId: ${orgId}`, "OrganizationsService.getOrganizationByOrgId");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization by orgId ${orgId}: ${error.message}`, "OrganizationsService.getOrganizationByOrgId");
      throw error;
    }
  }

  /**
   * ✅ NEW: Get organization by business-friendly orgCode
   */
  async getOrganizationByCode(orgCode: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization by orgCode: ${orgCode}`, "OrganizationsService.getOrganizationByCode");

      const org = await this.orgModel.findOne({ orgCode });
      if (!org) {
        this.logger.log(`Organization not found with orgCode: ${orgCode}`, "OrganizationsService.getOrganizationByCode");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization by orgCode ${orgCode}: ${error.message}`, "OrganizationsService.getOrganizationByCode");
      throw error;
    }
  }

  /**
   * Update organization (generic fields only, not onboarding)
   */
  async updateOrganization(orgId: string, updateData: any): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Updating organization ${orgId}`, "OrganizationsService.updateOrganization");

      const org = await this.orgModel.findByIdAndUpdate(orgId, updateData, {
        new: true,
      });

      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.updateOrganization");
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Organization updated: ${orgId}`, "OrganizationsService.updateOrganization");
      return org;
    } catch (error) {
      this.logger.log(`Error updating organization ${orgId}: ${error.message}`, "OrganizationsService.updateOrganization");
      throw error;
    }
  }

  /**
   * Delete organization
   */
  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting organization with id ${orgId}`, "OrganizationsService.deleteOrganization");

      const org = await this.orgModel.findByIdAndDelete(orgId);

      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.deleteOrganization");
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Organization deleted with id ${orgId}`, "OrganizationsService.deleteOrganization");
      return { message: "Organization deleted successfully" };
    } catch (error) {
      this.logger.log(`Error deleting organization ${orgId}: ${error.message}`, "OrganizationsService.deleteOrganization");
      throw error;
    }
  }

  /**
   * Find organization by multiple criteria
   */
  async findOne(filter: any): Promise<OrganizationDocument | null> {
    try {
      this.logger.log(`Searching organization with filter: ${JSON.stringify(filter)}`, "OrganizationsService.findOne");

      const org = await this.orgModel.findOne(filter);
      return org || null;
    } catch (error) {
      this.logger.log(`Error searching organization: ${error.message}`, "OrganizationsService.findOne");
      throw error;
    }
  }

  /**
   * Find all organizations
   */
  async findAll(filter: any = {}): Promise<OrganizationDocument[]> {
    try {
      this.logger.log(`Fetching all organizations with filter: ${JSON.stringify(filter)}`, "OrganizationsService.findAll");

      const orgs = await this.orgModel.find(filter);
      return orgs;
    } catch (error) {
      this.logger.log(`Error fetching organizations: ${error.message}`, "OrganizationsService.findAll");
      throw error;
    }
  }

  /**
   * Count organizations
   */
  async countOrganizations(filter: any = {}): Promise<number> {
    try {
      const count = await this.orgModel.countDocuments(filter);
      return count;
    } catch (error) {
      this.logger.log(`Error counting organizations: ${error.message}`, "OrganizationsService.countOrganizations");
      throw error;
    }
  }


  /**
   * Check if organization name exists (excluding DRAFT status)
   */
  async checkOrgNameAvailability(legalName: string, role: UserRole): Promise<{ available: boolean; message?: string }> {
    const existing = await this.orgModel.findOne({
      legalName: new RegExp(`^${legalName}$`, 'i'),
      role,
      kycStatus: { $in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'] },
    });

    if (existing) {
      return {
        available: false,
        message: 'An organization with this name already exists. Please search and join using an invite code.',
      };
    }

    return { available: true };
  }

  /**
   * Search APPROVED organizations by name or code
   */
  async searchOrganizations(searchTerm: string, role: UserRole): Promise<any[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const searchRegex = new RegExp(searchTerm, 'i');

    const organizations = await this.orgModel
      .find({
        role,
        kycStatus: 'APPROVED', // Only show approved orgs
        $or: [{ legalName: searchRegex }, { orgCode: searchRegex }],
      })
      .select('orgCode legalName kycStatus role')
      .limit(10)
      .lean();

    return organizations.map((org) => ({
      orgCode: org.orgCode,
      legalName: org.legalName,
      kycStatus: org.kycStatus,
      role: org.role,
    }));
  }

  /**
   * Generate invite code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid 0,O,1,I
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create invite code for organization (ADMIN ONLY)
   */
  async createInviteCode(orgCode: string, expiryDays: number = 7): Promise<{ inviteCode: string; expiresAt: Date }> {
    const org = await this.orgModel.findOne({ orgCode });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.kycStatus !== 'APPROVED') {
      throw new BadRequestException('Can only create invite codes for approved organizations');
    }

    // Generate unique code
    let code: string;
    let exists: any;

    do {
      code = this.generateInviteCode();
      exists = await this.orgModel.exists({ inviteCode: code });
    } while (exists != null);

    // Set expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Update org
    org.inviteCode = code;
    org.inviteCodeExpiry = expiresAt;
    org.inviteCodeCreatedAt = new Date();
    await org.save();

    return { inviteCode: code, expiresAt };
  }

  /**
   * Delete/revoke invite code (ADMIN ONLY)
   */
  async revokeInviteCode(orgCode: string): Promise<{ success: boolean }> {
    const org = await this.orgModel.findOne({ orgCode });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    org.inviteCode = null;
    org.inviteCodeExpiry = null;
    org.inviteCodeCreatedAt = null;
    await org.save();

    return { success: true };
  }

  /**
   * Validate invite code
   */
  async validateInviteCode(inviteCode: string): Promise<{ valid: boolean; orgCode?: string; legalName?: string; message?: string }> {
    const org = await this.orgModel.findOne({ inviteCode });

    if (!org) {
      return { valid: false, message: 'Invalid invite code' };
    }

    // Check expiry
    if (org.inviteCodeExpiry && org.inviteCodeExpiry < new Date()) {
      return { valid: false, message: 'Invite code has expired' };
    }

    return {
      valid: true,
      orgCode: org.orgCode,
      legalName: org.legalName,
    };
  }
}
