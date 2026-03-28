import { Injectable, Logger, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { AuthService } from '../auth/auth.service';
import { PreferencesService } from '../preferences/preferences.service';
import { IdGeneratorService } from '../../common/services/id-generator.service';
import { KycCase, KycCaseDocument } from '../kyc/schemas/kyc.schema';
import { FastTrackOnboardDto } from './dto/admin-onboarding.dto';
import { UserRole } from '../../common/enums';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csvParser = require('csv-parser');
import { Readable } from 'stream';

@Injectable()
export class AdminOnboardingService {
  private readonly logger = new Logger(AdminOnboardingService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    private authService: AuthService,
    private preferencesService: PreferencesService,
    private idGenerator: IdGeneratorService,
  ) {}

  /**
   * Returns the default temporary password 'qwerty123'
   */
  private generateTempPassword(): string {
    return 'qwerty123';
  }

  /**
   * Create a single user account and link to a fully verified Organization mapping.
   */
  async onboardSingleUser(dto: FastTrackOnboardDto): Promise<any> {
    const { user: userDto, organization: orgDto, preferences } = dto;
    const tempPassword = this.generateTempPassword();

    this.logger.log(`Starting Fast-Track onboarding for ${userDto.email}`);

    // ------------- STEP 1: CREATE USER -------------
    let authResult: any;
    try {
      authResult = await this.authService.register({
        email: userDto.email,
        mobile: userDto.mobile,
        firstName: userDto.firstName,
        lastName: userDto.lastName,
        role: userDto.role,
        password: tempPassword,
      });
    } catch (e: any) {
      if (e instanceof ConflictException) throw e;
      this.logger.error("User creation failed", e);
      throw new InternalServerErrorException("Failed to provision user credentials");
    }

    const userId = authResult.user.id;

    // ------------- STEP 2: CREATE ORGANIZATION -------------
    let createdOrg: any;
    try {
      const orgCode = await this.idGenerator.generateOrgCode(orgDto.legalName);

      const orgPayload = {
        orgCode,
        orgId: orgCode,
        legalName: orgDto.legalName,
        role: userDto.role,
        kycStatus: "APPROVED",
        isVerified: true,
        isOnboardingLocked: true, 
        
        // Nested OrgKyc structure
        orgKyc: {
          legalName: orgDto.legalName,
          tradeName: orgDto.tradeName || orgDto.legalName,
          gstin: orgDto.gstin,
          pan: orgDto.pan,
          cin: orgDto.cin,
          registeredAddress: orgDto.registeredAddress,
          businessType: orgDto.businessType,
          incorporationDate: orgDto.incorporationDate,
          serviceStates: orgDto.serviceStates || [],
          primaryContact: {
            name: `${userDto.firstName} ${userDto.lastName}`.trim(),
            email: userDto.email,
            mobile: userDto.mobile,
            role: orgDto.primaryContactRole || 'Owner',
          },
        },

        // Creation Source Traceability
        creationSource: dto.creationSource || 'ADMIN_SINGLE',

        // Bank Details explicit capture
        ...(orgDto.bankDetails && { primaryBankAccount: orgDto.bankDetails }),
      };

      const newOrg = new this.organizationModel(orgPayload);
      createdOrg = await newOrg.save();

      // Bind the User -> Organization ID
      await this.userModel.findByIdAndUpdate(userId, { organizationId: createdOrg._id });

      // Build an auto-approved proxy KYC timeline object
      const dummyCase = new this.kycCaseModel({
        organizationId: createdOrg._id,
        organizationCode: orgCode,
        caseCode: `FASTRK-${orgCode}-001`,
        status: "APPROVED",
        submissionAttempt: 1,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: 'FAST-TRACK-SYSTEM',
        submittedData: {
            orgKyc: orgPayload.orgKyc,
            primaryBankAccount: orgPayload.primaryBankAccount || null,
        },
        activityLog: [
            { action: "SUBMITTED", timestamp: new Date(), performedBy: "SYSTEM", remarks: "Fast-Track Auto Submit" },
            { action: "APPROVED", timestamp: new Date(), performedBy: "SYSTEM", remarks: "Fast-Track Auto Approve" }
        ],
      });
      await dummyCase.save();

    } catch (e: any) {
      this.logger.error("Organization creation failed", e);
      await this.userModel.findByIdAndDelete(userId);
      throw new InternalServerErrorException("Failed to construct Organization. Contact Support.");
    }

    const orgIdString = createdOrg._id.toString();

    // ------------- STEP 3: UPSERT PREFERENCES -------------
    if (preferences) {
      try {
        if (userDto.role === UserRole.BUYER) await this.preferencesService.upsertBuyerPreference(orgIdString, preferences as any);
        else if (userDto.role === UserRole.SELLER) await this.preferencesService.upsertSellerPreference(orgIdString, preferences as any);
        else if (userDto.role === UserRole.LOGISTIC) await this.preferencesService.upsertLogisticPreference(orgIdString, preferences as any);
      } catch (e) {
        this.logger.warn(`Organization created, but preferences serialization failed: ${e.message}`);
      }
    } else {
        if (userDto.role === UserRole.BUYER) await this.preferencesService.upsertBuyerPreference(orgIdString, { procurementCategories: [] } as any);
        if (userDto.role === UserRole.SELLER) await this.preferencesService.upsertSellerPreference(orgIdString, { capacityMT: 100 } as any);
        if (userDto.role === UserRole.LOGISTIC) await this.preferencesService.upsertLogisticPreference(orgIdString, { maxCapacityMT: 100 } as any);
    }

    return {
      success: true,
      message: 'Fast-Track account successfully generated.',
      userId,
      organizationId: orgIdString,
      tempPassword,
    };
  }

  /**
   * Bulk onboard users from a mapped CSV stream.
   */
  async processBulkCSV(fileBuffer: Buffer, assignedRole?: UserRole): Promise<any> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: any[] = [];
      const stream = Readable.from(fileBuffer);
      
      stream
        .pipe(csvParser())
        .on('data', (row: any) => {
          const rowRole = (row.role?.toUpperCase() as UserRole) || assignedRole;

          if (![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(rowRole)) {
              errors.push({ email: row.email, error: `Invalid or missing role: ${row.role || 'N/A'}` });
              return;
          }

          const dto: FastTrackOnboardDto = {
            user: {
                email: row.email,
                mobile: row.mobile,
                firstName: row.firstName,
                lastName: row.lastName,
                role: rowRole,
            },
            organization: {
                legalName: row.legalName,
                tradeName: row.tradeName,
                gstin: row.gstin,
                pan: row.pan,
                cin: row.cin,
                businessType: row.businessType || 'Private Limited',
                incorporationDate: row.incorporationDate,
                registeredAddress: row.registeredAddress || 'Registered HQ',
                serviceStates: row.serviceStates ? row.serviceStates.split(';').map(s => s.trim()) : [],
                bankDetails: (row.bankAccountNumber || row.bankIfsc) ? {
                    accountNumber: row.bankAccountNumber,
                    accountHolderName: row.bankAccountHolderName || `${row.firstName} ${row.lastName}`.trim(),
                    accountType: row.bankAccountType || 'Current',
                    ifsc: row.bankIfsc,
                    bankName: row.bankName || 'NOT SPECIFIED',
                    branchName: row.branchName || '',
                } : undefined,
            },
            preferences: Object.keys(row)
                 .filter(k => k.startsWith('pref_') && row[k])
                 .reduce((acc, k) => { acc[k.replace('pref_', '')] = row[k]; return acc; }, {}),
            creationSource: 'ADMIN_BULK'
          };
          results.push(dto);
        })
        .on('end', async () => {
          const successLogs = [];
          for (let i = 0; i < results.length; i++) {
            try {
                const res = await this.onboardSingleUser(results[i]);
                successLogs.push({ email: results[i].user.email, status: 'Success', tempPwd: res.tempPassword });
            } catch (err: any) {
                errors.push({ email: results[i].user?.email, error: err.message });
            }
          }
          resolve({ processed: results.length, successful: successLogs.length, failed: errors.length, results: successLogs, errors });
        })
        .on('error', (err: any) => reject(err));
    });
  }

  generateCsvTemplate(role?: UserRole): string {
    const baseHeaders = 'role,email,mobile,firstName,lastName,legalName,tradeName,gstin,pan,cin,businessType,incorporationDate,registeredAddress,serviceStates,bankAccountNumber,bankAccountHolderName,bankAccountType,bankIfsc,bankName,branchName';
    
    if (role === UserRole.SELLER) return baseHeaders + ',pref_capacityMT,pref_certifications\n';
    if (role === UserRole.LOGISTIC) return baseHeaders + ',pref_maxCapacityMT\n';
    if (role === UserRole.BUYER) return baseHeaders + ',pref_procurementCategories\n';
    
    return baseHeaders + ',pref_capacityMT,pref_maxCapacityMT,pref_procurementCategories\n';
  }
}
