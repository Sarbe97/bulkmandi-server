import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '@modules/organizations/schemas/organization.schema';
import { KycCase, KycCaseDocument } from '@modules/kyc/schemas/kyc.schema';
import { UserRole } from '@common/enums';

@Injectable()
export class IdGeneratorService {
    constructor(
        @InjectModel(Organization.name)
        private readonly orgModel: Model<OrganizationDocument>,
        @InjectModel(KycCase.name)
        private readonly kycCaseModel: Model<KycCaseDocument>,
    ) { }

    private getRolePrefix(role: UserRole): string {
        const prefixes = {
            [UserRole.SELLER]: 'SEL',
            [UserRole.BUYER]: 'BUY',
            [UserRole.LOGISTIC]: 'LOG',
        };
        return prefixes[role] || 'UNK';
    }

    /**
     * Generate unique organization code
     * Format: ORG-{ROLE}-{SEQUENCE}
     * Example: ORG-SEL-000123
     */
    /**
     * Generate unique organization code
     * Format: {NAME_PREFIX}-{RANDOM_4_DIGIT}
     * Example: ABCS-1234
     */
    async generateOrgCode(legalName: string): Promise<string> {
        // Sanitize: A-Z only, Uppercase
        let prefix = legalName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 4);

        // Ensure at least 3 chars
        if (prefix.length < 3) {
            prefix = (prefix + "ORG").substring(0, 4); // Pad with ORG if too short
        }
        if (prefix.length === 0) prefix = "ORG";

        let retries = 0;
        while (retries < 10) {
            const suffix = Math.floor(1000 + Math.random() * 9000); // 1000-9999
            const orgCode = `${prefix}-${suffix}`;

            const exists = await this.orgModel.exists({ orgCode });
            if (!exists) {
                return orgCode;
            }
            retries++;
        }
        // Fallback to timestamp to guarantee uniqueness
        return `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    /**
     * Generate unique KYC case code
     * Format: KYC-{ORG_CODE}-{ATTEMPT}
     * Example: KYC-ABCS-1234-001
     */
    async generateCaseCode(organizationCode: string, submissionAttempt: number): Promise<string> {
        const attempt = submissionAttempt.toString().padStart(3, '0');
        return `KYC-${organizationCode}-${attempt}`;
    }

    /**
     * Parse organization code
     * @deprecated Org codes no longer contain role info
     */
    parseOrgCode(orgCode: string): { role: UserRole | null; sequence: number } {
        return { role: null, sequence: 0 };
    }

    /**
     * Parse KYC case code to extract organization code and attempt
     */
    parseCaseCode(caseCode: string): { organizationCode: string | null; attempt: number } {
        // Updated regex to handle variable length org codes
        const match = caseCode.match(/^KYC-(.+)-(\d{3})$/);
        if (!match) {
            return { organizationCode: null, attempt: 0 };
        }

        return {
            organizationCode: match[1],
            attempt: parseInt(match[2], 10),
        };
    }
}
