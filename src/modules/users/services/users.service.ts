import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Organization, OrganizationDocument } from '../../organizations/schemas/organization.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) { }

  async findAll(): Promise<User[]> {
    return this.userModel
      .find()
      .select('-password')
      .populate('organizationId', 'legalName orgCode kycStatus')
      .exec();
  }

  async findById(id: string): Promise<User> {
    console.log(id);
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

  /**
   * Generates a CSV string of all users for bulk onboarding purposes, 
   * including organization KYC and verification details.
   */
  async downloadUsersCsv(): Promise<string> {
    const users = await this.userModel.find().populate('organizationId').exec();
    
    const headers = [
      'email', 'firstName', 'lastName', 'mobile', 'role', 'isActive', 'createdAt',
      'legalName', 'orgCode', 'tradeName', 'gstin', 'pan', 'cin', 'businessType', 
      'incorporationDate', 'registeredAddress', 'serviceStates',
      'primaryContactName', 'primaryContactEmail', 'primaryContactMobile',
      'kycStatus', 'isVerified', 'kycApprovedAt', 'kycApprovedBy',
      'bankAccountNumber', 'bankAccountHolderName', 'bankAccountType', 'bankIfsc', 'bankName', 'branchName',
      'isPennyDropVerified', 'pennyDropStatus', 'pennyDropScore'
    ];
    
    const rows = users.map(user => {
      const org = user.organizationId as any;
      const kyc = org?.orgKyc || {};
      const bank = org?.primaryBankAccount || {};
      const contact = kyc?.primaryContact || {};

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
        
        // Primary Contact
        contact.name || '',
        contact.email || '',
        contact.mobile || '',
        
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
        bank.isPennyDropVerified ? 'YES' : 'NO',
        bank.pennyDropStatus || '',
        bank.pennyDropScore || ''
      ].map(val => {
        const strVal = (val === null || val === undefined) ? '' : val.toString();
        // Escape quotes and wrap in quotes
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
