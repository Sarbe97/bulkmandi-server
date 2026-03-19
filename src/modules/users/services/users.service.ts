import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

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
    return this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).exec();
  }
}
