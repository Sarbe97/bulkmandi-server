import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BuyerService } from './buyer.service';
import { BuyerQueryDto } from './dto/buyer-query.dto';

@ApiTags('Buyer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  @Roles(UserRole.BUYER)
  @Get('orders')
  async getMyOrders(@CurrentUser() user: any, @Query() query: BuyerQueryDto) {
    return this.buyerService.getOrdersForBuyer(user.organizationId, query.status);
  }

  @Roles(UserRole.BUYER)
  @Get('payments')
  async getMyPayments(@CurrentUser() user: any, @Query() query: BuyerQueryDto) {
    return this.buyerService.getPaymentsForBuyer(user.organizationId, query.status);
  }
}
