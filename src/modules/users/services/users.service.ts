import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Organization, OrganizationDocument } from '../../organizations/schemas/organization.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private readonly logger: CustomLoggerService,
  ) { }

  async findAll(): Promise<User[]> {
    this.logger.log('Fetching all users');
    return this.userModel
      .find()
      .select('-password')
      .populate('organizationId', 'legalName orgCode kycStatus')
      .exec();
  }

  async findById(id: string): Promise<User> {
    this.logger.log(`Fetching user by ID: ${id}`);
    const user = await this.userModel
      .findById(id)
      .select('-password')
      .populate('organizationId', 'legalName orgCode kycStatus');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateStatus(id: string, isActive: boolean): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(id, { isActive }, { new: true }).select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async resetPassword(id: string, newPassword: string): Promise<User> {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    const user = await this.userModel.findByIdAndUpdate(id, { password: hashedPassword }, { new: true }).select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).populate('organizationId');
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastLoginAt: new Date() });
  }

  async updateUser(userId: string, updateData: Partial<User>) {
    const user = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).exec();

    // Sync with Organization if user belongs to one
    if (user && user.organizationId) {
      if (updateData.firstName !== undefined || updateData.lastName !== undefined || updateData.mobile !== undefined) {
        const setFields: Record<string, any> = {};
        
        if (updateData.firstName !== undefined || updateData.lastName !== undefined) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          setFields['orgKyc.primaryContact.name'] = fullName;
        }
        
        if (updateData.mobile !== undefined) {
          setFields['orgKyc.primaryContact.mobile'] = user.mobile;
        }
        
        if (Object.keys(setFields).length > 0) {
          await this.orgModel.updateOne(
            { _id: user.organizationId },
            { $set: setFields }
          );
        }
      }
    }

    return user;
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    this.logger.warn(`Attempting to delete user: ${userId}`);
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Prevent deleting Admin users
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      throw new Error('Cannot delete an administrator account.');
    }

    if (user.organizationId) {
      await this.orgModel.findByIdAndDelete(user.organizationId);
    }

    await this.userModel.findByIdAndDelete(userId);

    return { success: true, message: `User ${user.email} and associated org deleted permanently.` };
  }

  async bulkDelete(userIds: string[]): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const id of userIds) {
      try {
        await this.deleteUser(id);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`ID ${id}: ${err.message}`);
      }
    }

    return { successCount, failedCount, errors };
  }

  /**
   * Generates a CSV string of all users for bulk onboarding purposes, 
   * including organization KYC and verification details.
   */
  async downloadUsersCsv(): Promise<string> {
    const users = await this.userModel.find().populate('organizationId').exec();
    
    const headers = [
      'email', 'firstName', 'lastName', 'mobile', 'role', 'isActive', 'createdAt',
      'legalName', 'orgCode', 'tradeName', 'gstin', 'pan', 'cin', 'businessType', 
      'incorporationDate', 'registeredAddress', 'serviceStates', 'plantLocations',
      'primaryContactName', 'primaryContactEmail', 'primaryContactMobile', 'primaryContactRole',
      'kycStatus', 'isVerified', 'kycApprovedAt', 'kycApprovedBy',
      'bankAccountNumber', 'bankAccountHolderName', 'bankAccountType', 'bankIfsc', 'bankName', 'branchName',
      'payoutMethod', 'upiDetails', 'isPennyDropVerified', 'pennyDropStatus', 'pennyDropScore',
      'complianceWarranty', 'complianceTerms', 'complianceAml'
    ];
    
    const rows = users.map(user => {
      const org = user.organizationId as any;
      const kyc = org?.orgKyc || {};
      const bank = org?.primaryBankAccount || {};
      const contact = kyc?.primaryContact || {};
      const compliance = org?.compliance || {};

      return [
        user.email,
        user.firstName || '',
        user.lastName || '',
        user.mobile || '',
        user.role,
        user.isActive ? 'ACTIVE' : 'INACTIVE',
        user.createdAt ? new Date(user.createdAt).toISOString() : '',
        
        // Org KYC
        org?.legalName || '',
        org?.orgCode || '',
        kyc.tradeName || '',
        kyc.gstin || '',
        kyc.pan || '',
        kyc.cin || '',
        kyc.businessType || '',
        kyc.incorporationDate || '',
        kyc.registeredAddress || '',
        Array.isArray(kyc.serviceStates) ? kyc.serviceStates.join('; ') : '',
        Array.isArray(kyc.plantLocations) ? kyc.plantLocations.map((p: any) => `${p.name}|${p.city}|${p.state}|${p.pincode}`).join('; ') : '',
        
        // Primary Contact
        contact.name || '',
        contact.email || '',
        contact.mobile || '',
        contact.role || '',
        
        // Verification / KYC Status
        org?.kycStatus || '',
        org?.isVerified ? 'YES' : 'NO',
        org?.kycApprovedAt ? new Date(org.kycApprovedAt).toISOString() : '',
        org?.kycApprovedBy || '',
        
        // Bank Details
        bank.accountNumber || '',
        bank.accountHolderName || '',
        bank.accountType || '',
        bank.ifsc || '',
        bank.bankName || '',
        bank.branchName || '',
        bank.payoutMethod || '',
        bank.upiDetails || '',
        bank.isPennyDropVerified ? 'YES' : 'NO',
        bank.pennyDropStatus || '',
        bank.pennyDropScore || '',

        // Compliance
        compliance.declarations?.warrantyAssurance ? 'true' : 'false',
        compliance.declarations?.termsAccepted ? 'true' : 'false',
        compliance.declarations?.amlCompliance ? 'true' : 'false',
      ].map(val => {
        const strVal = (val === null || val === undefined) ? '' : val.toString();
        // Escape quotes and wrap in quotes
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Find all verified sellers on the platform. Fallback to all active sellers if none are approved (dev mode support).
   */
  async findVerifiedSellers() {
    this.logger.debug('Finding sellers for broadcast notification...');
    
    // Primary: Approved Organizations
    let orgs = await this.orgModel.find({ kycStatus: 'APPROVED' }).select('_id');
    
    // Fallback: If no approved orgs, find all active organizations (for dev testing)
    if (orgs.length === 0) {
      this.logger.warn('No APPROVED organizations found. Falling back to all ACTIVE organizations for notification broadcast.');
      orgs = await this.orgModel.find({ isVerified: true }).select('_id');
    }
    
    // Ultimate Fallback: If still none, get all organizations (last resort to ensure notification logic is exercised)
    if (orgs.length === 0) {
      orgs = await this.orgModel.find().select('_id');
    }

    const orgIds = orgs.map(org => org._id);
    this.logger.debug(`Targeting ${orgIds.length} organizations for seller discovery.`);
    
    const users = await this.userModel.find({ 
      organizationId: { $in: orgIds },
      role: 'SELLER',
      isActive: true 
    }).select('_id organizationId email');

    this.logger.debug(`Found ${users.length} active sellers to notify.`);
    return users;
  }

  async findByOrgId(orgId: string): Promise<User[]> {
    this.logger.debug(`Finding active users for organization: ${orgId}`);
    return this.userModel.find({ 
      organizationId: new Types.ObjectId(orgId), 
      isActive: true 
    }).exec();
  }

  /**
   * Find all active Admin and Super Admin users on the platform.
   * Used for system-level notifications (e.g. carrier rejection, dispute escalations).
   */
  async findAdmins(): Promise<User[]> {
    this.logger.debug('Finding all active admin users for system notification');
    return this.userModel.find({
      role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
      isActive: true,
    }).select('_id email firstName lastName role').exec();
  }
}
