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
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Create order from accepted quote (Internal - called by quotes service)' })
  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @ApiOperation({ summary: 'Get my orders (Buyer/Seller)' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @Get('me')
  async getMyOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const role = user.role;
    if (role === UserRole.BUYER) {
      return this.ordersService.findByBuyerId(
        user.organizationId,
        { status },
        page,
        limit,
      );
    } else {
      return this.ordersService.findBySellerId(
        user.organizationId,
        { status },
        page,
        limit,
      );
    }
  }

  @ApiOperation({ summary: 'Get order by ID' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole['3PL'], UserRole.ADMIN)
  @Get(':id')
  async getOrderById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Update order status (Seller/Admin)' })
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Put(':id/status')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto.status);
  }

  @ApiOperation({ summary: 'Mark order as dispatch ready (Seller)' })
  @Roles(UserRole.SELLER)
  @Put(':id/dispatch-ready')
  async markDispatchReady(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.ordersService.markDispatchReady(id, user.organizationId);
  }

  @ApiOperation({ summary: 'Cancel order (Buyer/Seller/Admin)' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @Put(':id/cancel')
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.ordersService.cancel(id, user.id, body.reason);
  }

  @ApiOperation({ summary: 'Get order documents' })
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole['3PL'], UserRole.ADMIN)
  @Get(':id/documents')
  async getOrderDocuments(@Param('id') id: string) {
    return this.ordersService.getDocuments(id);
  }

  @ApiOperation({ summary: 'Upload proforma invoice (Seller)' })
  @Roles(UserRole.SELLER)
  @Post(':id/documents/proforma-invoice')
  async uploadProformaInvoice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { fileUrl: string; fileId: string },
  ) {
    return this.ordersService.uploadDocument(id, 'proforma', body);
  }

  @ApiOperation({ summary: 'Upload tax invoice (Seller)' })
  @Roles(UserRole.SELLER)
  @Post(':id/documents/tax-invoice')
  async uploadTaxInvoice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { fileUrl: string; fileId: string },
  ) {
    return this.ordersService.uploadDocument(id, 'taxInvoice', body);
  }
}
