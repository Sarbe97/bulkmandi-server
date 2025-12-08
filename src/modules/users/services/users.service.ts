import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

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
