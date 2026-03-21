import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { AdminOnboardingService } from './admin-onboarding.service';
import { FastTrackOnboardDto } from './dto/admin-onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UserRole } from '../../common/enums';

@ApiTags('Admin Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/onboarding')
export class AdminOnboardingController {
  constructor(private readonly adminOnboardingService: AdminOnboardingService) {}

  @Post('single')
  @ApiOperation({ summary: 'Create a single User, Organization, and Preference record instantly.' })
  async onboardSingleUser(@Body() dto: FastTrackOnboardDto) {
    return this.adminOnboardingService.onboardSingleUser(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk insert multiple organizations from a CSV file.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        role: { type: 'string', enum: [UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC] },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async onboardBulkUsers(
    @UploadedFile() file: Express.Multer.File,
    @Body('role') role: UserRole, // Body field for the form-data
  ) {
    if (!file) throw new BadRequestException('A valid .csv file is required.');
    if (![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(role)) {
      throw new BadRequestException('Valid role is required in the form data.');
    }

    // Pass the buffer stream down to the service for native CSV parsing out of memory
    return this.adminOnboardingService.processBulkCSV(file.buffer, role);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download the custom CSV template for the designated role.' })
  getTemplate(
    @Query('role') role: UserRole,
    @Res() res: any,
  ) {
    if (![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(role)) {
      throw new BadRequestException('Valid role query parameter is required.');
    }

    const templateContent = this.adminOnboardingService.generateCsvTemplate(role);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=BulkMandi_${role}_Onboarding.csv`);
    res.send(templateContent);
  }
}
