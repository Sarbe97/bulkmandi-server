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
import { CreateBatchDto } from './dto/create-batch.dto';
import { RunPayoutsDto } from './dto/run-payouts.dto';
import { SettlementsService } from './settlements.service';

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @ApiOperation({ summary: 'Create settlement batch (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Post('batches')
  async createBatch(
    @CurrentUser() user: any,
    @Body() createBatchDto: CreateBatchDto,
  ) {
    return this.settlementsService.createBatch(createBatchDto, user.id);
  }

  @ApiOperation({ summary: 'Get all settlement batches (Admin)' })
  @Roles(UserRole.ADMIN)
  @Get('batches')
  async getAllBatches(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.settlementsService.findAllBatches({ status }, page, limit);
  }

  @ApiOperation({ summary: 'Get settlement batch by ID' })
  @Roles(UserRole.ADMIN, UserRole.SELLER, UserRole['3PL'])
  @Get('batches/:id')
  async getBatchById(@Param('id') id: string) {
    return this.settlementsService.findBatchByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Run payouts for batch (Admin)' })
  @Roles(UserRole.ADMIN)
  @Post('batches/:id/run-payouts')
  async runPayouts(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() runPayoutsDto: RunPayoutsDto,
  ) {
    return this.settlementsService.runPayouts(id, user.id);
  }

  @ApiOperation({ summary: 'Get my payouts (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole['3PL'])
  @Get('payouts/me')
  async getMyPayouts(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.settlementsService.findPayoutsByPayeeId(
      user.organizationId,
      { status },
      page,
      limit,
    );
  }

  @ApiOperation({ summary: 'Get payout by ID' })
  @Roles(UserRole.SELLER, UserRole['3PL'], UserRole.ADMIN)
  @Get('payouts/:id')
  async getPayoutById(@Param('id') id: string) {
    return this.settlementsService.findPayoutByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Mark payout as confirmed (Admin)' })
  @Roles(UserRole.ADMIN)
  @Put('payouts/:id/confirm')
  async confirmPayout(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { bankReference: string; utrs: string[] },
  ) {
    return this.settlementsService.confirmPayout(id, body);
  }

  @ApiOperation({ summary: 'Get settlement summary for period (Admin)' })
  @Roles(UserRole.ADMIN)
  @Get('summary')
  async getSettlementSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.settlementsService.getSummary(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get my settlement history (Seller/3PL)' })
  @Roles(UserRole.SELLER, UserRole['3PL'])
  @Get('history/me')
  async getMySettlementHistory(@CurrentUser() user: any) {
    return this.settlementsService.getHistoryByPayeeId(user.organizationId);
  }
}
