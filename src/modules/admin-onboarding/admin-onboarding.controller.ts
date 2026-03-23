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
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentHandlerService } from '../../core/file/services/document-handler.service';
import { multerOptions } from '../user-onboarding/config/multer.config';

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
  constructor(
    private readonly adminOnboardingService: AdminOnboardingService,
    private readonly documentHandlerService: DocumentHandlerService,
  ) {}

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
    @Body('role') role?: UserRole, // Body field for the form-data (Optional if CSV has role)
  ) {
    if (!file) throw new BadRequestException('A valid .csv file is required.');
    
    if (role && ![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(role)) {
      throw new BadRequestException('If provided, role must be a valid UserRole.');
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
    if (role && ![UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC].includes(role)) {
      throw new BadRequestException('If provided, role query parameter must be valid.');
    }

    const templateContent = this.adminOnboardingService.generateCsvTemplate(role);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=BulkMandi_${role}_Onboarding.csv`);
    res.send(templateContent);
  }

  @Post(':orgId/documents')
  @ApiOperation({ summary: 'Upload an admin-provided document to an explicitly stated Organization ID' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('document', multerOptions))
  async uploadAdminDocument(
    @Param('orgId') orgId: string,
    @Body() body: { docType: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!body.docType) throw new BadRequestException('docType is required');

    return this.documentHandlerService.uploadDocument(orgId, file, body.docType);
  }
}
