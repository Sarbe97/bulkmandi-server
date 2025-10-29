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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyUtrDto } from './dto/verify-utr.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Initiate payment for order (Buyer only)' })
  @Roles(UserRole.BUYER)
  @Post()
  async createPayment(
    @CurrentUser() user: any,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(user.organizationId, createPaymentDto);
  }

  @ApiOperation({ summary: 'Verify payment with UTR' })
  @Roles(UserRole.BUYER)
  @Put(':id/verify')
  async verifyUTR(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() verifyUtrDto: VerifyUtrDto,
  ) {
    return this.paymentsService.verifyUTR(id, verifyUtrDto);
  }

  @ApiOperation({ summary: 'Get payment by ID' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @Get(':id')
  async getPaymentById(@Param('id') id: string) {
    return this.paymentsService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Get my payments (Buyer)' })
  @Roles(UserRole.BUYER)
  @Get('me')
  async getMyPayments(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.paymentsService.findByPayerId(
      user.organizationId,
      { status },
      page,
      limit,
    );
  }

  @ApiOperation({ summary: 'Get payment for order' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @Get('order/:orderId')
  async getPaymentByOrderId(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrderId(orderId);
  }

  @ApiOperation({ summary: 'Release escrow (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Put(':id/release-escrow')
  async releaseEscrow(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.paymentsService.releaseEscrow(id, user.id, body.reason);
  }

  @ApiOperation({ summary: 'Refund payment (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Put(':id/refund')
  async refundPayment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.paymentsService.refund(id, body.amount, body.reason);
  }
}
