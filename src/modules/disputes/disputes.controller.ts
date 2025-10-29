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
import { DisputesService } from './disputes.service';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @ApiOperation({ summary: 'Raise dispute (Buyer/Seller)' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @Post()
  async raiseDispute(
    @CurrentUser() user: any,
    @Body() raiseDisputeDto: RaiseDisputeDto,
  ) {
    return this.disputesService.raise(user.organizationId, raiseDisputeDto);
  }

  @ApiOperation({ summary: 'Get my disputes' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @Get('me')
  async getMyDisputes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.disputesService.findByPartyId(
      user.organizationId,
      { status },
      page,
      limit,
    );
  }

  @ApiOperation({ summary: 'Get dispute by ID' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @Get(':id')
  async getDisputeById(@Param('id') id: string) {
    return this.disputesService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Upload evidence' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @Post(':id/evidence')
  async uploadEvidence(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: {
      evidenceType: string;
      fileUrl: string;
      description: string;
    },
  ) {
    return this.disputesService.uploadEvidence(id, body, user.id);
  }

  @ApiOperation({ summary: 'Resolve dispute (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Put(':id/resolve')
  async resolveDispute(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() resolveDisputeDto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(id, resolveDisputeDto, user.id);
  }

  @ApiOperation({ summary: 'Assign dispute to admin (Admin)' })
  @Roles(UserRole.ADMIN)
  @Put(':id/assign')
  async assignDispute(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { assignTo: string },
  ) {
    return this.disputesService.assign(id, body.assignTo);
  }

  @ApiOperation({ summary: 'Get disputes by order' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @Get('order/:orderId')
  async getDisputesByOrder(@Param('orderId') orderId: string) {
    return this.disputesService.findByOrderId(orderId);
  }

  @ApiOperation({ summary: 'Check if dispute window is open' })
  @Roles(UserRole.BUYER)
  @Get('order/:orderId/window-status')
  async checkDisputeWindow(@Param('orderId') orderId: string) {
    return this.disputesService.checkDisputeWindow(orderId);
  }
}
