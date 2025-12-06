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
    async generateOrgCode(role: UserRole): Promise<string> {
        const rolePrefix = this.getRolePrefix(role);

        // Count existing organizations with the same role
        const count = await this.orgModel.countDocuments({ role });
        const sequence = (count + 1).toString().padStart(6, '0');

        const orgCode = `ORG-${rolePrefix}-${sequence}`;

        // Ensure uniqueness (in case of race conditions)
        const exists = await this.orgModel.exists({ orgCode });
        if (exists) {
            // Retry with incremented count
            const retrySequence = (count + 2).toString().padStart(6, '0');
            return `ORG-${rolePrefix}-${retrySequence}`;
        }

        return orgCode;
    }

    /**
     * Generate unique KYC case code
     * Format: KYC-{ORG_CODE}-{ATTEMPT}
     * Example: KYC-ORG-SEL-000123-001
     */
    async generateCaseCode(organizationCode: string, submissionAttempt: number): Promise<string> {
        const attempt = submissionAttempt.toString().padStart(3, '0');
        return `KYC-${organizationCode}-${attempt}`;
    }

    /**
     * Parse organization code to extract role and sequence
     */
    parseOrgCode(orgCode: string): { role: UserRole | null; sequence: number } {
        const match = orgCode.match(/^ORG-(SEL|BUY|LOG)-(\d{6})$/);
        if (!match) {
            return { role: null, sequence: 0 };
        }

        const rolePrefixMap: Record<string, UserRole> = {
            'SEL': UserRole.SELLER,
            'BUY': UserRole.BUYER,
            'LOG': UserRole.LOGISTIC,
        };

        return {
            role: rolePrefixMap[match[1]] || null,
            sequence: parseInt(match[2], 10),
        };
    }

    /**
     * Parse KYC case code to extract organization code and attempt
     */
    parseCaseCode(caseCode: string): { organizationCode: string | null; attempt: number } {
        const match = caseCode.match(/^KYC-(ORG-[A-Z]{3}-\d{6})-(\d{3})$/);
        if (!match) {
            return { organizationCode: null, attempt: 0 };
        }

        return {
            organizationCode: match[1],
            attempt: parseInt(match[2], 10),
        };
    }
}
