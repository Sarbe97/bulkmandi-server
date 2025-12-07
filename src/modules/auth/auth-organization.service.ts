import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UserRole } from "src/common/enums";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { User, UserDocument } from "../users/schemas/user.schema";

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

@Injectable()
export class AuthOrganizationService {
    constructor(
        @InjectModel(User.name)
        private userModel: Model<UserDocument>,

        @InjectModel(Organization.name)
        private organizationModel: Model<OrganizationDocument>,

        private idGenerator: IdGeneratorService,
    ) { }

    /**
     * Search for organizations by name or code
     */
    async searchOrganizations(searchTerm: string, role: UserRole): Promise<OrgSearchResult[]> {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        const searchRegex = new RegExp(searchTerm, 'i');

        const organizations = await this.organizationModel
            .find({
                role,
                $or: [
                    { legalName: searchRegex },
                    { orgCode: searchRegex },
                ],
            })
            .select('orgCode legalName kycStatus role')
            .limit(10)
            .lean();

        return organizations.map(org => ({
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
        // APPROVED, SUBMITTED, INFO_REQUESTED, REVISION_REQUESTED = yes
        // REJECTED = no
        // DRAFT = yes (first user)
        return kycStatus !== 'REJECTED';
    }

    /**
     * Link user to an existing organization
     */
    async linkUserToOrganization(userId: string, orgCode: string, requestRevision: boolean = false): Promise<LinkResult> {
        // Find user
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if user already linked to an organization
        if (user.organizationId) {
            throw new BadRequestException('User is already linked to an organization');
        }

        // Find organization
        const org = await this.organizationModel.findOne({ orgCode });
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
                message: 'This organization\'s KYC was rejected. Please contact support or create a new organization.',
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
                // Mark for revision - handled by KYC service
                redirectTo = 'onboarding';
                message = 'Organization KYC marked for revision. Please update the information.';
            } else {
                redirectTo = 'dashboard';
                message = 'Welcome! Your organization is already approved.';
            }
        } else if (org.kycStatus === 'SUBMITTED' || org.kycStatus === 'INFO_REQUESTED') {
            redirectTo = 'onboarding';
            message = 'Your organization\'s KYC is under review. You can view the information.';
        } else {
            // DRAFT or other statuses
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
        const user = await this.userModel.findById(userId);
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
        const existingOrg = await this.organizationModel.findOne({
            legalName: new RegExp(`^${orgData.legalName}$`, 'i'),
            role: orgData.role,
        });

        if (existingOrg) {
            throw new ConflictException('An organization with this name already exists for this role');
        }

        // Generate orgCode
        const orgCode = await this.idGenerator.generateOrgCode(orgData.role);

        // Create organization
        const organization = new this.organizationModel({
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
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if already linked
        if (user.organizationId) {
            throw new BadRequestException('User is already linked to an organization');
        }

        // Find organization by invite code
        const org = await this.organizationModel.findOne({ inviteCode });
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
}
