import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PriceMonitorService } from '../services/price-monitor.service';

@ApiTags('Admin Price Monitor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/price-monitor')
export class PriceMonitorController {
  constructor(private readonly priceMonitorService: PriceMonitorService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async getPriceIndices(@Query() query: any) {
    return this.priceMonitorService.getPriceIndices(query);
  }
}
