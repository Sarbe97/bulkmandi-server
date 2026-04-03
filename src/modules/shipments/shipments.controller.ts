import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Delete,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ShipmentsService } from './shipments.service';
import { KycGuard } from 'src/common/guards/kyc.guard';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@ApiTags('Shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly logger: CustomLoggerService,
  ) {}

  @ApiOperation({ summary: 'Create shipment (Seller assigns 3PL)' })
  @Roles(UserRole.SELLER)
  @UseGuards(KycGuard)
  @Post()
  async createShipment(
    @CurrentUser() user: any,
    @Body() createShipmentDto: CreateShipmentDto,
  ) {
    this.logger.log(`Shipment creation request from seller: ${user.organizationId} for order: ${createShipmentDto.orderId}`);
    return this.shipmentsService.create(user.organizationId, createShipmentDto);
  }

  @ApiOperation({ summary: 'Get all shipments (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Get()
  async getShipments(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const filter: any = {};
    if (status) filter.status = status;
    return this.shipmentsService.findAll(filter, page, limit);
  }

  @ApiOperation({ summary: 'Get my shipments' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC)
  @Get('me')
  async getMyShipments(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const filter: any = {};
    if (status) filter.status = status;
    
    const role = user.role;
    if (role === UserRole.BUYER) {
      return this.shipmentsService.findByBuyerId(
        user.organizationId,
        filter,
        page,
        limit,
      );
    } else if (role === UserRole.SELLER) {
      return this.shipmentsService.findBySellerId(
        user.organizationId,
        filter,
        page,
        limit,
      );
    } else {
      return this.shipmentsService.findByCarrierId(
        user.organizationId,
        filter,
        page,
        limit,
      );
    }
  }

  @ApiOperation({ summary: 'Get shipment by ID' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.LOGISTIC, UserRole.ADMIN)
  @Get(':id')
  async getShipmentById(@Param('id') id: string) {
    return this.shipmentsService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Update milestone (3PL, Seller)' })
  @Roles(UserRole.LOGISTIC, UserRole.SELLER)
  @UseGuards(KycGuard)
  @Post(':id/milestones')
  async updateMilestone(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
  ) {
    return this.shipmentsService.addMilestone(id, updateMilestoneDto);
  }

  @ApiOperation({ summary: 'Upload document (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @UseGuards(KycGuard)
  @Post(':id/documents')
  async uploadDocument(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() uploadDocumentDto: UploadDocumentDto,
  ) {
    return this.shipmentsService.uploadDocument(
      id,
      uploadDocumentDto,
      user.id,
      user.role,
    );
  }
  
  @ApiOperation({ summary: 'Upload document multipart (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @UseGuards(KycGuard)
  @Post(':id/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocumentMultipart(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('docType') docType: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.shipmentsService.uploadDocumentMultipart(
      id,
      docType,
      file,
      user.id,
      user.role,
    );
  }

  @ApiOperation({ summary: 'Download shipment document (Secure)' })
  @Get(':id/documents/:docId/download')
  async downloadDocument(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: any,
  ) {
    try {
      const { buffer, fileName, mimeType } = await this.shipmentsService.downloadDocument(id, docId, user);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (err: any) {
      this.logger.error(`Download failed: ${err.message}`, 'ShipmentsController.downloadDocument');
      res.status(403).json({ message: err.message || 'Access Denied' });
    }
  }

  @ApiOperation({ summary: 'Delete document (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @UseGuards(KycGuard)
  @Delete(':id/documents/:docId')
  async deleteDocument(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.shipmentsService.deleteDocument(id, docId, user.id);
  }

  @ApiOperation({ summary: 'Upload POD (Logistic/Seller)' })
  @Roles(UserRole.LOGISTIC, UserRole.SELLER)
  @UseGuards(KycGuard)
  @Post(':id/pod')
  async uploadPOD(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { receiverName: string; podPhotos: string[] },
  ) {
    return this.shipmentsService.uploadPOD(id, body);
  }

  @ApiOperation({ summary: 'Verify document (Admin)' })
  @Roles(UserRole.ADMIN)
  @Put(':id/documents/:docId/verify')
  async verifyDocument(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.shipmentsService.verifyDocument(id, docId, user.id);
  }

  @ApiOperation({ summary: 'Get shipment tracking' })
  @Get(':id/tracking')
  async getTracking(@Param('id') id: string) {
    return this.shipmentsService.getTracking(id);
  }

  @ApiOperation({ summary: 'Mark shipment as delivered (Logistic/Seller/Admin)' })
  @Roles(UserRole.LOGISTIC, UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(KycGuard)
  @Put(':id/deliver')
  async markDelivered(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    this.logger.log(`Delivery confirmation request for shipment: ${id} by user: ${user.id}`);
    return this.shipmentsService.markDelivered(id);
  }

  @ApiOperation({ summary: 'Confirm dispatch (Seller/Logistic)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @UseGuards(KycGuard)
  @Put(':id/dispatch')
  async confirmDispatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.shipmentsService.confirmDispatch(id, user.id, user.organizationId);
  }

  @ApiOperation({ summary: 'Add tracking milestone (Carrier/Seller)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @Post(':id/milestones')
  async addMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.shipmentsService.addMilestone(id, dto);
  }

  @ApiOperation({ summary: 'Update shipment status (Seller/Logistic)' })
  @Roles(UserRole.SELLER, UserRole.LOGISTIC)
  @UseGuards(KycGuard)
  @Put(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.shipmentsService.updateStatus(id, body.status);
  }
}
