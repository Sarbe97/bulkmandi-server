import {
  Body,
  Controller, Get,
  Param,
  Post, Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { PublishRfqDto } from './dto/publish-rfq.dto';
import { RfqService } from './rfq.service';

@ApiTags('RFQ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rfq')
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @ApiOperation({ summary: 'Create RFQ (Buyer only)' })
  @Roles(UserRole.BUYER)
  @Post()
  async createRFQ(@CurrentUser() user: any, @Body() createRfqDto: CreateRfqDto) {
    return this.rfqService.create(user.organizationId, createRfqDto);
  }

  @ApiOperation({ summary: 'Publish RFQ (Buyer only)' })
  @Roles(UserRole.BUYER)
  @Put(':id/publish')
  async publishRFQ(@CurrentUser() user: any, @Param('id') id: string, @Body() publishRfqDto: PublishRfqDto) {
    return this.rfqService.publish(id, user.organizationId);
  }

  @ApiOperation({ summary: 'Get my RFQs (Buyer)' })
  @Roles(UserRole.BUYER)
  @Get('me')
  async getMyRFQs(@CurrentUser() user: any, @Query('status') status?: string, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.rfqService.findByBuyerId(user.organizationId, { status }, page, limit);
  }

  @ApiOperation({ summary: 'Get RFQ by ID' })
  @Get(':id')
  async getRFQById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rfqService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Get open RFQs (Seller view)' })
  @Roles(UserRole.SELLER)
  @Get('open')
  async getOpenRFQs(@CurrentUser() user: any, @Query('category') category?: string, @Query('grade') grade?: string, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.rfqService.findOpenRFQs({ category, grade }, page, limit);
  }

  @ApiOperation({ summary: 'Close/Cancel RFQ (Buyer)' })
  @Roles(UserRole.BUYER)
  @Put(':id/close')
  async closeRFQ(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rfqService.close(id, user.organizationId);
  }
}
