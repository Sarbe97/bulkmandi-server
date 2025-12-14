import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { User, UserDocument } from "@modules/users/schemas/user.schema";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { UserOrgKycDto } from "../../dto";

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
                    kycStatus: "DRAFT",
                    status: "Active",
                });

                await org.save();
                organizationId = org._id.toString();

                // Link to User
                await this.userModel.findByIdAndUpdate(userId, { organizationId: org._id });
                this.logger.log(`Created new Organization ${organizationId} and linked to user ${userId}`);
            }

            this.checkEditPermission(org);

            // Check for duplicates
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
