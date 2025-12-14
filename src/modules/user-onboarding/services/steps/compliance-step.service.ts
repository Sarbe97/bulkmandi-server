import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { FleetAndComplianceFormDataDto } from "../../dto/fleet-compliance.dto";

@Injectable()
export class ComplianceStepService {
    constructor(
        @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
        private readonly logger: CustomLoggerService,
    ) { }

    async updateComplianceDocs(organizationId: string, dto: any, userRole: UserRole): Promise<OrganizationDocument> {
        try {
            this.logger.log(`updateComplianceDocs: org=${organizationId}, role=${userRole}`);

            const org = await this.orgModel.findById(organizationId);
            if (!org) throw new NotFoundException("Organization not found");

            this.checkEditPermission(org);

            if (!dto.warrantyAssurance || !dto.termsAccepted || !dto.amlCompliance) {
                throw new BadRequestException("All declarations must be accepted");
            }

            if (!dto.documents || dto.documents.length === 0) {
                throw new BadRequestException("At least one compliance document is required");
            }

            org.compliance = {
                documents: dto.documents.map((doc) => ({
                    docType: doc.docType,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    uploadedAt: new Date(doc.uploadedAt || new Date()),
                    status: doc.status,
                })),
                declarations: {
                    warrantyAssurance: dto.warrantyAssurance,
                    termsAccepted: dto.termsAccepted,
                    amlCompliance: dto.amlCompliance,
                },
            };

            if (!org.completedSteps.includes("compliance-docs")) {
                org.completedSteps.push("compliance-docs");
            }

            await org.save();
            this.logger.log(`Compliance docs updated for org ${organizationId}`);

            return org;
        } catch (error) {
            this.logger.error(`Error updating compliance docs for org ${organizationId}: ${error.message}`);
            throw error;
        }
    }

    async updateFleetAndCompliance(
        organizationId: string,
        dto: FleetAndComplianceFormDataDto,
        userRole: UserRole,
    ): Promise<OrganizationDocument> {
        if (userRole !== UserRole.LOGISTIC) {
            throw new ForbiddenException('Step "fleet-compliance" is only for logistic users');
        }

        const org = await this.orgModel.findById(organizationId);
        if (!org) throw new NotFoundException('Organization not found');

        this.checkEditPermission(org);

        // Save/update fleet & compliance data
        org.fleetAndCompliance = {
            fleetTypes: dto.fleetTypes,
            insuranceExpiry: dto.insuranceExpiry,
            policyDocument: dto.policyDocument,
            ewayBillIntegration: dto.ewayBillIntegration,
            podMethod: dto.podMethod,
        };

        if (!org.completedSteps.includes('fleet-compliance')) {
            org.completedSteps.push('fleet-compliance');
        }

        await org.save();
        this.logger.log(`Fleet compliance updated for org ${organizationId}`);

        return org;
    }

    private checkEditPermission(org: OrganizationDocument): void {
        if (org.isOnboardingLocked) {
            throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`);
        }
    }
}
