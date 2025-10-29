import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@ApiTags('Shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @ApiOperation({ summary: 'Create shipment (Seller assigns 3PL)' })
  @Roles(UserRole.SELLER)
  @Post()
  async createShipment(
    @CurrentUser() user: any,
    @Body() createShipmentDto: CreateShipmentDto,
  ) {
    return this.shipmentsService.create(user.organizationId, createShipmentDto);
  }

  @ApiOperation({ summary: 'Get my shipments' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole['3PL'])
  @Get('me')
  async getMyShipments(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const role = user.role;
    if (role === UserRole.BUYER) {
      return this.shipmentsService.findByBuyerId(
        user.organizationId,
        { status },
        page,
        limit,
      );
    } else if (role === UserRole.SELLER) {
      return this.shipmentsService.findBySellerId(
        user.organizationId,
        { status },
        page,
        limit,
      );
    } else {
      return this.shipmentsService.findByCarrierId(
        user.organizationId,
        { status },
        page,
        limit,
      );
    }
  }

  @ApiOperation({ summary: 'Get shipment by ID' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole['3PL'], UserRole.ADMIN)
  @Get(':id')
  async getShipmentById(@Param('id') id: string) {
    return this.shipmentsService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Update milestone (3PL, Seller)' })
  @Roles(UserRole['3PL'], UserRole.SELLER)
  @Post(':id/milestones')
  async updateMilestone(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
  ) {
    return this.shipmentsService.addMilestone(id, updateMilestoneDto);
  }

  @ApiOperation({ summary: 'Upload document (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole['3PL'])
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
    );
  }

  @ApiOperation({ summary: 'Upload POD (3PL)' })
  @Roles(UserRole['3PL'])
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

  @ApiOperation({ summary: 'Mark shipment as delivered (3PL)' })
  @Roles(UserRole['3PL'])
  @Put(':id/deliver')
  async markDelivered(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.shipmentsService.markDelivered(id);
  }
}
