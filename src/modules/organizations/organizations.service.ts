import { UsersService } from "../users/services/users.service";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { Organization, OrganizationDocument } from "./schemas/organization.schema";
import { UserRole } from "@common/enums";

export interface OrgSearchResult {
  orgCode: string;
  legalName: string;
  kycStatus: string;
  role: string;
  canAcceptNewUsers: boolean;
}

export interface LinkResult {
  success: boolean;
  organizationId: string;
  orgCode: string;
  kycStatus: string;
  redirectTo: 'dashboard' | 'onboarding' | 'error';
  message: string;
}

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
    private readonly idGenerator: IdGeneratorService,
    private readonly usersService: UsersService, // ✅ Injected UsersService
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
   * Search organizations by name or code (More permissive for linking)
   */
  async searchOrganizations(searchTerm: string, role: UserRole): Promise<OrgSearchResult[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const searchRegex = new RegExp(searchTerm, 'i');

    const organizations = await this.orgModel
      .find({
        role,
        // Removed kycStatus restriction to allow joining approved/pending orgs
        $or: [{ legalName: searchRegex }, { orgCode: searchRegex }],
      })
      .select('orgCode legalName kycStatus role')
      .limit(10)
      .lean();

    return organizations.map((org) => ({
      orgCode: org.orgCode,
      legalName: org.legalName,
      kycStatus: org.kycStatus || 'DRAFT',
      role: org.role,
      canAcceptNewUsers: this.canOrgAcceptNewUsers(org.kycStatus),
    }));
  }

  /**
   * Check if organization can accept new users based on KYC status
   */
  private canOrgAcceptNewUsers(kycStatus: string): boolean {
    return kycStatus !== 'REJECTED';
  }

  /**
   * Link user to an existing organization
   */
  async linkUserToOrganization(userId: string, orgCode: string, requestRevision: boolean = false): Promise<LinkResult> {
    // Find user (Using injected service, but implementation gets Document which we need to save)
    // NOTE: UsersService.findById returns Promise<User>. We assume User is a Document or compatible with .save()
    // If UsersService returns a POJO/Interface without .save(), we need to use UserModel carefully or update UsersService.
    // However, typical NestJS Mongoose usage returns HydratedDocument unless .lean() is used.
    // If UsersService.findById uses .populate() without .lean(), it returns a Document.
    // Let's try.
    const user: any = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already linked to an organization
    if (user.organizationId) {
      // If it's the SAME organization, just return success
      const currentOrg = await this.getOrganization(user.organizationId.toString());
      if (currentOrg.orgCode === orgCode) {
        return {
          success: true,
          organizationId: currentOrg._id.toString(),
          orgCode: currentOrg.orgCode,
          kycStatus: currentOrg.kycStatus,
          redirectTo: currentOrg.kycStatus === 'APPROVED' ? 'dashboard' : 'onboarding',
          message: 'Already linked to this organization',
        };
      }
      throw new BadRequestException('User is already linked to an organization');
    }

    // Find organization
    const org = await this.orgModel.findOne({ orgCode });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Check if organization can accept new users
    if (org.kycStatus === 'REJECTED') {
      return {
        success: false,
        organizationId: org._id.toString(),
        orgCode: org.orgCode,
        kycStatus: org.kycStatus,
        redirectTo: 'error',
        message: 'This organization\'s KYC was rejected.',
      };
    }

    // Link user to organization
    user.organizationId = new Types.ObjectId(org._id.toString());
    await user.save();

    // Determine redirect based on KYC status and revision request
    let redirectTo: 'dashboard' | 'onboarding' | 'error' = 'onboarding';
    let message = 'Successfully linked to organization';

    if (org.kycStatus === 'APPROVED') {
      if (requestRevision) {
        redirectTo = 'onboarding';
        message = 'Organization KYC marked for revision. Please update the information.';
      } else {
        redirectTo = 'dashboard';
        message = 'Welcome! Your organization is already approved.';
      }
    } else if (org.kycStatus === 'SUBMITTED' || org.kycStatus === 'INFO_REQUESTED') {
      redirectTo = 'onboarding';
      message = 'Your organization\'s KYC is under review.';
    } else {
      redirectTo = 'onboarding';
      message = 'Please complete the organization KYC process.';
    }

    return {
      success: true,
      organizationId: org._id.toString(),
      orgCode: org.orgCode,
      kycStatus: org.kycStatus,
      redirectTo,
      message,
    };
  }

  /**
   * Create new organization and link user
   */
  async createOrganizationAndLinkUser(
    userId: string,
    orgData: { legalName: string; role: UserRole }
  ): Promise<LinkResult> {
    // Find user
    const user: any = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already linked
    if (user.organizationId) {
      throw new BadRequestException('User is already linked to an organization');
    }

    // Verify role matches
    if (user.role !== orgData.role) {
      throw new BadRequestException('Organization role must match user role');
    }

    // Check if organization name already exists for this role
    const existingOrg = await this.orgModel.findOne({
      legalName: new RegExp(`^${orgData.legalName}$`, 'i'),
      role: orgData.role,
    });

    if (existingOrg) {
      throw new ConflictException('An organization with this name already exists for this role');
    }

    // Generate orgCode
    const orgCode = await this.idGenerator.generateOrgCode(orgData.role);

    // Create organization
    const organization = new this.orgModel({
      orgCode,
      legalName: orgData.legalName,
      role: orgData.role,
      completedSteps: [],
      kycStatus: 'DRAFT',
      status: 'ACTIVE',
      isVerified: false,
    });
    const savedOrg = await organization.save();

    // Link user to organization
    user.organizationId = new Types.ObjectId(savedOrg._id.toString());
    await user.save();

    return {
      success: true,
      organizationId: savedOrg._id.toString(),
      orgCode: savedOrg.orgCode,
      kycStatus: 'DRAFT',
      redirectTo: 'onboarding',
      message: 'Organization created successfully. Please complete the KYC process.',
    };
  }

  async joinWithInviteCode(userId: string, inviteCode: string): Promise<LinkResult> {
    // Find user
    const user: any = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already linked
    if (user.organizationId) {
      throw new BadRequestException('User is already linked to an organization');
    }

    // Find organization by invite code
    const org = await this.orgModel.findOne({ inviteCode });
    if (!org) {
      throw new NotFoundException('Invalid invite code');
    }

    // Check expiry
    if (org.inviteCodeExpiry && org.inviteCodeExpiry < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    // Check role match
    if (user.role !== org.role) {
      throw new BadRequestException(
        `Role mismatch. You are ${user.role} but this organization is for ${org.role}s`,
      );
    }

    // Check org status
    if (org.kycStatus !== 'APPROVED') {
      throw new BadRequestException('Organization KYC is not approved yet');
    }

    // Link user to org
    user.organizationId = new Types.ObjectId(org._id.toString());
    user.usedInviteCode = inviteCode;
    await user.save();

    // Clear invite code (single-use)
    org.inviteCode = null;
    org.inviteCodeExpiry = null;
    await org.save();

    return {
      success: true,
      organizationId: org._id.toString(),
      orgCode: org.orgCode,
      kycStatus: org.kycStatus,
      redirectTo: 'dashboard',
      message: `Successfully joined ${org.legalName}`,
    };
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
