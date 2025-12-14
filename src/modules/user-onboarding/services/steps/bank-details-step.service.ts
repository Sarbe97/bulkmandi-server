import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserRole } from "@common/enums";
import { CustomLoggerService } from "@core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "@modules/organizations/schemas/organization.schema";
import { UserBankDto } from "../../dto";

@Injectable()
export class BankDetailsStepService {
    constructor(
        @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
        private readonly logger: CustomLoggerService,
    ) { }

    async updateBankDetails(organizationId: string, dto: UserBankDto, userRole: UserRole): Promise<OrganizationDocument> {
        try {
            this.logger.log(`updateBankDetails: org=${organizationId}, role=${userRole}`);

            const org = await this.orgModel.findById(organizationId);
            if (!org) throw new NotFoundException("Organization not found");

            this.checkEditPermission(org);

            if (!org.primaryBankAccount) {
                org.primaryBankAccount = { documents: [] } as any;
            }

            org.primaryBankAccount = {
                accountNumber: dto.accountNumber,
                accountHolderName: dto.accountHolderName,
                ifsc: dto.ifsc,
                bankName: dto.bankName,
                branchName: dto.branchName,
                accountType: dto.accountType,

                payoutMethod: dto.payoutMethod,
                upiDetails: dto.upiDetails,

                pennyDropStatus: dto.pennyDropStatus || "PENDING",
                pennyDropScore: dto.pennyDropScore || 0,

                documents: (dto.documents || []).map((doc) => ({
                    docType: doc.docType,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    uploadedAt: new Date(doc.uploadedAt || new Date()),
                    status: doc.status,
                })),
            };

            if (!org.completedSteps.includes("bank-details")) {
                org.completedSteps.push("bank-details");
            }

            await org.save();
            this.logger.log(`Bank details updated for org ${organizationId}`);

            return org;
        } catch (error) {
            this.logger.error(`Error updating bank details for org ${organizationId}: ${error.message}`);
            throw error;
        }
    }

    private checkEditPermission(org: OrganizationDocument): void {
        if (org.isOnboardingLocked) {
            throw new ForbiddenException(`Cannot edit onboarding. Current status: ${org.kycStatus}. You can only edit when status is DRAFT or REJECTED.`);
        }
    }
}
