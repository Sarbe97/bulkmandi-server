import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from './schemas/otp.schema';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
  ) {}

  async sendOtp(identifier: string, type: 'EMAIL' | 'PHONE'): Promise<{ success: boolean; message: string }> {
    // Check TEST_MODE for hardcoding 123456
    const isTestMode = process.env.TEST_MODE === 'true';
    const otp = isTestMode ? '123456' : crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save to DB (overwrite if already exists for this identifier and type)
    await this.otpModel.findOneAndUpdate(
      { identifier, type },
      { otp, expiresAt, isUsed: false },
      { upsert: true, new: true },
    );

    // Bypassing real send logic as requested, just log it.
    this.logger.log(`\n\n---------------- OTP ----------------\nTYPE: ${type}\nTO: ${identifier}\nOTP: ${otp}\nTEST_MODE: ${isTestMode ? 'ACTIVE (FIXED 123456)' : 'OFF'}\n--------------------------------------\n\n`);

    // In a real scenario, we would call a Mail or SMS service here.
    if (type === 'EMAIL') {
       this.logger.log(`[MAIL SERVICE] Sending OTP ${otp} to ${identifier}...`);
       // Logic for actual mail sending will be added here in the future
    } else {
       this.logger.log(`[SMS SERVICE] SMS sending logic will be implemented in the future.`);
    }

    return { success: true, message: `OTP sent successfully to ${identifier}` };
  }

  async verifyOtp(identifier: string, otp: string): Promise<{ success: boolean; message: string }> {
    // TEST_MODE bypass: Allow '123456' to always work if TEST_MODE is active
    if (process.env.TEST_MODE === 'true' && otp === '123456') {
      this.logger.warn(`OTP verification bypassed for ${identifier} via TEST_MODE`);
      return { success: true, message: 'OTP verified (TEST_MODE BYPASS)' };
    }

    const record = await this.otpModel.findOne({ identifier, otp, isUsed: false });

    if (!record) {
      throw new BadRequestException('Invalid OTP or identifier');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    record.isUsed = true;
    await record.save();

    return { success: true, message: 'OTP verified successfully' };
  }
}
