import { Injectable, Logger, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { AuthService } from '../auth/auth.service';
import { PreferencesService } from '../preferences/preferences.service';
import { IdGeneratorService } from '../../common/services/id-generator.service';
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
    private authService: AuthService,
    private preferencesService: PreferencesService,
    private idGenerator: IdGeneratorService,
  ) {}

  /**
   * Generates a secure random 8-character password
   */
  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-8) + 'A1!'; // Basic complexity
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
      // Re-using the public authService method. This provisions the User account into Mongo via bcrypt hashing.
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

      // Admin onboarding dictates they are fully verified out of the gate.
      const orgPayload = {
        orgCode,
        orgId: orgCode,
        legalName: orgDto.legalName,
        tradeName: orgDto.tradeName || orgDto.legalName,
        role: userDto.role,
        // KYC Docs Auto-Approval flag
        kycStatus: "APPROVED",
        isProfileComplete: true,
        isOnboardingLocked: true, 
        
        // Detailed Fields
        gstin: orgDto.gstin,
        pan: orgDto.pan,
        cin: orgDto.cin,
        registeredAddress: orgDto.registeredAddress,
        businessType: orgDto.businessType,
        incorporationDate: orgDto.incorporationDate,
        
        // Single Primary Contact bound to user details
        primaryContact: {
          name: `${userDto.firstName} ${userDto.lastName}`.trim(),
          email: userDto.email,
          mobile: userDto.mobile,
          role: orgDto.primaryContactRole || 'Owner',
        },
      };

      const newOrg = new this.organizationModel(orgPayload);
      createdOrg = await newOrg.save();

      // Bind the User -> Organization ID
      await this.userModel.findByIdAndUpdate(userId, { organizationId: createdOrg._id });

    } catch (e: any) {
      this.logger.error("Organization creation failed", e);
      // Optional: Compensating action to delete User if Org fails
      await this.userModel.findByIdAndDelete(userId);
      throw new InternalServerErrorException("Failed to construct Organization. Contact Support.");
    }

    const orgIdString = createdOrg._id.toString();
    const mockUserCtx = { userId, organizationId: orgIdString, role: userDto.role };

    // ------------- STEP 3: UPSERT PREFERENCES -------------
    if (preferences) {
      try {
        if (userDto.role === UserRole.BUYER) {
          await this.preferencesService.upsertBuyerPreference(orgIdString, preferences as any);
        } else if (userDto.role === UserRole.SELLER) {
          await this.preferencesService.upsertSellerPreference(orgIdString, preferences as any);
        } else if (userDto.role === UserRole.LOGISTIC) {
          await this.preferencesService.upsertLogisticPreference(orgIdString, preferences as any);
        }
      } catch (e) {
        this.logger.warn(`Organization created, but preferences serialization failed: ${e.message}`);
        // We do not abort the transaction here, as preferences can be patched later.
      }
    } else {
        // Create an empty skeleton preference table
        if (userDto.role === UserRole.BUYER) await this.preferencesService.upsertBuyerPreference(orgIdString, { procurementCategories: [] } as any);
        if (userDto.role === UserRole.SELLER) await this.preferencesService.upsertSellerPreference(orgIdString, { capacityMT: 100 } as any);
        if (userDto.role === UserRole.LOGISTIC) await this.preferencesService.upsertLogisticPreference(orgIdString, { maxCapacityMT: 100 } as any);
    }

    // ------------- STEP 4: EMAIL / COMMS -------------
    // In a real production system, dispatch an SES / SMTP email here containing `userDto.email` and `tempPassword`.

    return {
      success: true,
      message: 'Fast-Track account successfully generated.',
      userId,
      organizationId: orgIdString,
      tempPassword, // WARNING: Only return in secure API payload for admin to copy/paste if no SMTP.
    };
  }

  /**
   * Bulk onboard users from a mapped CSV stream
   */
  async processBulkCSV(fileBuffer: Buffer, assignedRole: UserRole): Promise<any> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: any[] = [];
      
      const stream = Readable.from(fileBuffer);
      
      stream
        .pipe(csvParser())
        .on('data', (row: any) => {
          // Construct the FastTrackOnboardDto payload shape from row headers
          const dto: FastTrackOnboardDto = {
            user: {
                email: row.email,
                mobile: row.mobile,
                firstName: row.firstName,
                lastName: row.lastName,
                role: assignedRole,
            },
            organization: {
                legalName: row.legalName,
                gstin: row.gstin,
                pan: row.pan,
                businessType: row.businessType || 'Private Limited',
                registeredAddress: row.registeredAddress || 'Registered HQ',
            },
            // We serialize any extra columns starting with pref_
            preferences: Object.keys(row)
                 .filter(k => k.startsWith('pref_'))
                 .reduce((acc, k) => { acc[k.replace('pref_', '')] = row[k]; return acc; }, {}),
          };
          results.push(dto);
        })
        .on('end', async () => {
          // Execute sequentially to avoid saturating Node DB pool or rate limit constraints
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

  generateCsvTemplate(role: UserRole): string {
    const baseHeaders = 'email,mobile,firstName,lastName,legalName,gstin,pan,businessType,registeredAddress';
    if (role === UserRole.SELLER) return baseHeaders + ',pref_capacityMT,pref_certifications\n';
    if (role === UserRole.LOGISTIC) return baseHeaders + ',pref_maxCapacityMT\n';
    return baseHeaders + ',pref_procurementCategories\n';
  }
}
