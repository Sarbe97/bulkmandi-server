import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send OTP (Email/Phone)' })
  @ApiResponse({ status: 201, description: 'OTP sent successfully' })
  async sendOtp(@Body() body: { identifier: string; type: 'EMAIL' | 'PHONE' }) {
    return this.otpService.sendOtp(body.identifier, body.type);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() body: { identifier: string; otp: string }) {
    return this.otpService.verifyOtp(body.identifier, body.otp);
  }
}
