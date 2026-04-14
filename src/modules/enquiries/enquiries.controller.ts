import { Body, Controller, Post, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnquiriesService } from './enquiries.service';
import { EnquiryStatus } from './schemas/enquiry.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Enquiries')
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit a new product enquiry (Buy/Sell)' })
  @ApiResponse({ status: 201, description: 'Enquiry submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or OTP' })
  async submitEnquiry(@Body() body: any) {
    return this.enquiriesService.createEnquiry(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @Get('seller/leads')
  @ApiOperation({ summary: 'Get categorized leads for the current seller' })
  async getSellerLeads(@CurrentUser() user: any) {
    return this.enquiriesService.getCategorizedLeads(user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/track-click')
  @ApiOperation({ summary: 'Track Call/WhatsApp engagement' })
  async trackEngagement(@Param('id') id: string, @Body('type') type: 'call' | 'whatsapp') {
    return this.enquiriesService.trackClick(id, type);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all enquiries (Admin only)' })
  async getAllEnquiries() {
    return this.enquiriesService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get enquiry by ID' })
  async getEnquiry(@Param('id') id: string) {
    return this.enquiriesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(':id/convert-to-rfq')
  @ApiOperation({ summary: 'Convert a marketplace lead to an official RFQ' })
  async convertToRfq(@Param('id') id: string, @CurrentUser() user: any) {
    return this.enquiriesService.convertToRfq(id, user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update enquiry status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: EnquiryStatus) {
    return this.enquiriesService.updateStatus(id, status);
  }
}
