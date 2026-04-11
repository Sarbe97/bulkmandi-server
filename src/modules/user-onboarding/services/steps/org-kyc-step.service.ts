import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { User, UserDocument } from "@modules/users/schemas/user.schema";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { UserOrgKycDto } from "../../dto";

import { KYCStatus } from "src/common/constants/app.constants";

@Injectable()
export class OrgKycStepService {
    constructor(
        @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly idGenerator: IdGeneratorService,
        private readonly logger: CustomLoggerService,
    ) { }

    async updateOrgKyc(organizationId: string | null, dto: UserOrgKycDto, userRole: UserRole, userId: string): Promise<OrganizationDocument> {
        try {
            this.logger.log(`updateOrgKyc: org=${organizationId}, role=${userRole}`);
            let org;

            if (organizationId) {
                org = await this.orgModel.findById(organizationId);
            }

            // If org doesn't exist or ID is null, create new one
            if (!org) {
                const orgCode = await this.idGenerator.generateOrgCode(dto.legalName);
                org = new this.orgModel({
                    orgCode,
                    orgId: orgCode,
                    legalName: dto.legalName,
                    role: userRole,
                    completedSteps: [],
                    isOnboardingLocked: false,
                    kycStatus: KYCStatus.DRAFT,
                    status: "Active",
                });

                await org.save();
                organizationId = org._id.toString();

                // Guard: one user per org — ensure no other user is already linked to this org
                const alreadyLinked = await this.userModel.findOne({ organizationId: org._id, _id: { $ne: userId } });
                if (alreadyLinked) {
                    // Roll back the org creation
                    await this.orgModel.deleteOne({ _id: org._id });
                    throw new ConflictException('This organization already has a registered user. Each organization can have only one account.');
                }

                // Link to User
                await this.userModel.findByIdAndUpdate(userId, { organizationId: org._id });
                this.logger.log(`Created new Organization ${organizationId} and linked to user ${userId}`);
            }

            this.checkEditPermission(org);

            // Check for duplicates — include DRAFT to block early-stage conflicts
            if (dto.legalName) {
                const existingName = await this.orgModel.findOne({
                    legalName: new RegExp(`^${dto.legalName.trim()}$`, 'i'),
                    _id: { $ne: org._id },
                    kycStatus: { $in: [KYCStatus.DRAFT, KYCStatus.SUBMITTED, KYCStatus.APPROVED, KYCStatus.REJECTED, KYCStatus.INFO_REQUESTED] },
                });
                if (existingName) {
                    throw new ConflictException(`An organization with the name "${dto.legalName}" already exists in the system.`);
                }
            }

            if (dto.incorporationDate && new Date(dto.incorporationDate) > new Date()) {
                throw new ConflictException("Incorporation date cannot be in the future.");
            }

            if (dto.gstin) {
                const existingGstin = await this.orgModel.findOne({
                    "orgKyc.gstin": dto.gstin,
                    _id: { $ne: org._id },
                });
                if (existingGstin) {
                    throw new ConflictException("GSTIN already registered with another organization.");
                }
            }

            if (dto.pan) {
                const existingPan = await this.orgModel.findOne({
                    "orgKyc.pan": dto.pan,
                    _id: { $ne: org._id },
                });
                if (existingPan) {
                    throw new ConflictException("PAN already registered with another organization.");
                }
            }

            org.legalName = dto.legalName;
            org.orgKyc = {
                legalName: dto.legalName,
                tradeName: dto.tradeName,
                gstin: dto.gstin,
                pan: dto.pan,
                cin: dto.cin,
                registeredAddress: dto.registeredAddress,
                businessType: dto.businessType,
                incorporationDate: dto.incorporationDate,
                primaryContact: dto.primaryContact,
                plantLocations: dto.plantLocations,
                serviceStates: dto.serviceStates,
            };

            if (!org.completedSteps.includes("org-kyc")) {
                org.completedSteps.push("org-kyc");
            }

            await org.save();
            this.logger.log(`KYC data updated for org ${organizationId}`);

            return org;
        } catch (error) {
            this.logger.error(`Error updating org KYC for org ${organizationId}: ${error.message}`);
            throw error;
        }
    }

    private checkEditPermission(org: OrganizationDocument): void {
        if (org.isOnboardingLocked) {
            throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`);
        }
    }
}
