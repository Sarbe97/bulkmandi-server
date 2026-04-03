import { ConflictException, Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { KycCase, KycCaseDocument } from '../kyc/schemas/kyc.schema';
import { FastTrackOnboardDto } from './dto/admin-onboarding.dto';
import { AuthService } from '../auth/auth.service';
import { UserRole } from 'src/common/enums';
import { PreferencesService } from '../preferences/preferences.service';
import { IdGeneratorService } from 'src/common/services/id-generator.service';
import { Readable } from 'stream';
const csv = require('csv-parser');

@Injectable()
export class AdminOnboardingService {
  constructor(
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(KycCase.name) private kycCaseModel: Model<KycCaseDocument>,
    private authService: AuthService,
    private preferencesService: PreferencesService,
    private idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) { }

  /**
   * Returns the default temporary password 'qwerty123'
   */
  getTemporaryPassword(): string {
    return 'qwerty123';
  }

  async onboardSingleUser(dto: FastTrackOnboardDto): Promise<{ user: User; tempPassword: string }> {
    const { user: userDto, organization: orgDto } = dto;

    this.logger.log(`Starting Fast-Track onboarding for email: ${userDto.email}, org: ${orgDto.legalName}`);

    // ------------- STEP 0: UNIQUENESS PRE-CHECKS -------------
    const existingOrg = await this.organizationModel.findOne({
      $or: [
        { legalName: orgDto.legalName },
        { 'orgKyc.gstin': orgDto.gstin },
        { 'orgKyc.pan': orgDto.pan }
      ]
    }).exec();

    if (existingOrg) {
      if (existingOrg.legalName === orgDto.legalName) throw new ConflictException(`Organization '${orgDto.legalName}' already exists.`);
      if (existingOrg.orgKyc?.gstin === orgDto.gstin) throw new ConflictException(`GSTIN '${orgDto.gstin}' is already registered.`);
      if (existingOrg.orgKyc?.pan === orgDto.pan) throw new ConflictException(`PAN '${orgDto.pan}' is already registered.`);
    }

    // ------------- STEP 1: CREATE USER -------------
    let authResult: any;
    try {
      authResult = await this.authService.register({
        email: userDto.email,
        password: this.getTemporaryPassword(),
        firstName: userDto.firstName,
        lastName: userDto.lastName,
        mobile: userDto.mobile,
        role: userDto.role,
      });
    } catch (e) {
      this.logger.error(`Failed to register user ${userDto.email}: ${e.message}`);
      throw e;
    }

    const userId = authResult.user.id;
    const orgCode = await this.idGenerator.generateOrgCode(orgDto.legalName);

    // ------------- STEP 2: CREATE ORGANIZATION -------------
    const orgPayload: any = {
      orgCode,
      legalName: orgDto.legalName,
      role: userDto.role,
      kycStatus: "APPROVED",
      isVerified: true,
      isOnboardingLocked: true,

      // Nested OrgKyc structure
      orgKyc: {
        legalName: orgDto.legalName,
        tradeName: orgDto.tradeName,
        gstin: orgDto.gstin,
        pan: orgDto.pan,
        cin: orgDto.cin,
        registeredAddress: orgDto.registeredAddress,
        businessType: orgDto.businessType,
        incorporationDate: orgDto.incorporationDate,
        serviceStates: orgDto.serviceStates || [],
        plantLocations: orgDto.plantLocations || [],
        primaryContact: {
          name: `${userDto.firstName} ${userDto.lastName}`.trim(),
          email: userDto.email,
          mobile: userDto.mobile,
          role: orgDto.primaryContactRole || 'PROPRIETOR',
        },
      },

      // Compliance / Declarations
      compliance: {
        documents: [],
        declarations: orgDto.compliance || {
          warrantyAssurance: true,
          termsAccepted: true,
          amlCompliance: true,
        },
      },

      // Creation Source Traceability
      creationSource: dto.creationSource || 'ADMIN_SINGLE',

      // Bank Details explicit capture
      ...(orgDto.bankDetails && { primaryBankAccount: orgDto.bankDetails }),
    };

    const organization = new this.organizationModel(orgPayload);
    const savedOrg = await organization.save();

    // ------------- STEP 3: LINK USER TO ORG -------------
    await this.userModel.findByIdAndUpdate(userId, {
      organizationId: savedOrg._id,
      isActive: true,
    });

    // ------------- STEP 4: AUTO-CREATE KYC CASE (SNAPSHOT) -------------
    const caseCode = await this.idGenerator.generateCaseCode(orgCode, 1);
    const dummyCase = new this.kycCaseModel({
      organizationId: savedOrg._id,
      organizationCode: orgCode,
      caseCode,
      status: "APPROVED",
      submissionAttempt: 1,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 'FAST-TRACK-SYSTEM',
      submittedData: {
        orgKyc: orgPayload.orgKyc,
        primaryBankAccount: orgPayload.primaryBankAccount || null,
        compliance: orgPayload.compliance || null,
      },
      activityLog: [
        { action: "SUBMITTED", timestamp: new Date(), performedBy: "SYSTEM", remarks: "Fast-Track Auto Submit" },
        { action: "APPROVED", timestamp: new Date(), performedBy: "SYSTEM", remarks: "Fast-Track Auto Approve" }
      ],
    });
    await dummyCase.save();

    // ------------- STEP 5: INITIALIZE ROLE PREFERENCES -------------
    const orgIdString = (savedOrg._id as Types.ObjectId).toString();
    if (dto.preferences) {
      try {
        if (userDto.role === UserRole.BUYER) await this.preferencesService.upsertBuyerPreference(orgIdString, dto.preferences as any);
        if (userDto.role === UserRole.SELLER) await this.preferencesService.upsertSellerPreference(orgIdString, dto.preferences as any);
        if (userDto.role === UserRole.LOGISTIC) await this.preferencesService.upsertLogisticPreference(orgIdString, dto.preferences as any);
      } catch (e) {
        this.logger.warn(`Organization created, but preferences serialization failed: ${e.message}`);
      }
    } else {
      if (userDto.role === UserRole.BUYER) await this.preferencesService.upsertBuyerPreference(orgIdString, { procurementCategories: [] } as any);
      if (userDto.role === UserRole.SELLER) await this.preferencesService.upsertSellerPreference(orgIdString, { capacityMT: 100 } as any);
      if (userDto.role === UserRole.LOGISTIC) await this.preferencesService.upsertLogisticPreference(orgIdString, { maxCapacityMT: 100 } as any);
    }

    return {
      user: authResult.user,
      tempPassword: this.getTemporaryPassword(),
    };
  }

  async processBulkCSV(fileBuffer: Buffer, assignedRole: UserRole): Promise<any> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: any[] = [];
      const stream = Readable.from(fileBuffer);

      this.logger.log(`Starting bulk CSV processing for role: ${assignedRole}`);

      stream
        .pipe(csv())
        .on('data', (row: any) => {
          // Robust Row Validation
          if (!row.email && !row.legalName) {
            this.logger.warn(`Skipping completely empty row.`);
            return;
          }

          if (!row.email) {
            this.logger.error(`Validation Failed: Missing Email for row ${JSON.stringify(row)}`);
            errors.push({ email: 'Unknown', error: 'Missing required field: Email' });
            return;
          }

          if (!row.legalName) {
            this.logger.error(`Validation Failed: Missing legalName for email ${row.email}`);
            errors.push({ email: row.email, error: 'Missing required field: Organization Name/legalName' });
            return;
          }

          const rowRole = (row.role?.toUpperCase() as UserRole) || assignedRole;
          if (![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(rowRole)) {
            this.logger.error(`Validation Failed: Invalid role '${row.role}' for email ${row.email}`);
            errors.push({ email: row.email, error: `Invalid or missing role: ${row.role || 'N/A'}` });
            return;
          }

          this.logger.log(`Row validation passed for ${row.email}. Queuing for insertion.`);

          // Construct DTO from Row
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
              serviceStates: row.serviceStates ? row.serviceStates.split(';').map((s: string) => s.trim()) : [],
              plantLocations: row.plantLocations ? row.plantLocations.split(';').map((p: string) => {
                const [name, city, state, pincode] = p.split('|').map(s => s.trim());
                return { name, city, state, pincode, country: 'India' };
              }) : [],
              bankDetails: (row.bankAccountNumber || row.bankIfsc) ? {
                accountNumber: row.bankAccountNumber,
                accountHolderName: row.bankAccountHolderName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
                accountType: row.bankAccountType || 'Current',
                ifsc: row.bankIfsc,
                bankName: row.bankName || 'NOT SPECIFIED',
                branchName: row.branchName || '',
                payoutMethod: row.payoutMethod || 'NEFT',
                upiDetails: row.upiDetails || '',
              } : undefined,
              compliance: {
                warrantyAssurance: row.complianceWarranty === 'true' || row.complianceWarranty === '1' || row.complianceWarranty === true || true,
                termsAccepted: row.complianceTerms === 'true' || row.complianceTerms === '1' || row.complianceTerms === true || true,
                amlCompliance: row.complianceAml === 'true' || row.complianceAml === '1' || row.complianceAml === true || true,
              }
            },
            preferences: Object.keys(row)
              .filter(k => k.startsWith('pref_') && row[k])
              .reduce((acc: any, k) => { acc[k.replace('pref_', '')] = row[k]; return acc; }, {}),
            creationSource: 'ADMIN_BULK'
          };
          results.push(dto);
        })
        .on('end', async () => {
          this.logger.log(`CSV Parsing complete. Commencing sequential processing of ${results.length} records.`);
          const successLogs = [];
          for (let i = 0; i < results.length; i++) {
            this.logger.log(`Executing onboardSingleUser for ${results[i].user.email}...`);
            try {
              const res = await this.onboardSingleUser(results[i]);
              this.logger.log(`Successfully onboarded ${results[i].user.email}`);
              successLogs.push({
                email: results[i].user.email,
                legalName: results[i].organization.legalName,
                status: 'Success',
                tempPwd: res.tempPassword
              });
            } catch (err: any) {
              this.logger.error(`Failed to onboard ${results[i].user?.email}: ${err.message}`, err.stack);
              errors.push({
                email: results[i].user?.email || 'Unknown',
                legalName: results[i].organization?.legalName || 'Unknown',
                error: err.message
              });
            }
          }
          this.logger.log(`Bulk processing complete. Total Processed: ${results.length}. Success: ${successLogs.length}, Failed: ${errors.length}.`);
          resolve({ processed: results.length, successful: successLogs.length, failed: errors.length, results: successLogs, errors });
        })
        .on('error', (err: any) => reject(err));
    });
  }

  generateCsvTemplate(role?: UserRole): string {
    const baseHeaders = 'role,email,mobile,firstName,lastName,legalName,tradeName,gstin,pan,cin,businessType,incorporationDate,registeredAddress,serviceStates,plantLocations,bankAccountNumber,bankAccountHolderName,bankAccountType,bankIfsc,bankName,branchName,payoutMethod,upiDetails,complianceWarranty,complianceTerms,complianceAml';
    
    if (role === UserRole.SELLER) return baseHeaders + ',pref_capacityMT,pref_certifications\n';
    if (role === UserRole.LOGISTIC) return baseHeaders + ',pref_maxCapacityMT\n';
    if (role === UserRole.BUYER) return baseHeaders + ',pref_procurementCategories\n';
    
    return baseHeaders + ',pref_capacityMT,pref_maxCapacityMT,pref_procurementCategories\n';
  }
}
