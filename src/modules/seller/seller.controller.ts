import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateCatalogDto } from '../catalog/dto/update-catalog.dto';
import { SellerService } from './seller.service';

@ApiTags('Seller')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('seller')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Roles(UserRole.SELLER)
  @Put('catalog')
  async updateCatalog(@CurrentUser() user: any, @Body() updateDto: UpdateCatalogDto) {
    return this.sellerService.updateCatalog(user.organizationId, updateDto);
  }
}
