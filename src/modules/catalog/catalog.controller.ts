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
import { CatalogService } from './catalog.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'Create my catalog (Seller only)' })
  @Roles(UserRole.SELLER)
  @Post()
  async createCatalog(
    @CurrentUser() user: any,
    @Body() createCatalogDto: CreateCatalogDto,
  ) {
    return this.catalogService.create(user.organizationId, createCatalogDto);
  }

  @ApiOperation({ summary: 'Get my catalog' })
  @Roles(UserRole.SELLER)
  @Get('me')
  async getMyCatalog(@CurrentUser() user: any) {
    return this.catalogService.getByOrganizationId(user.organizationId);
  }

  @ApiOperation({ summary: 'Update my catalog' })
  @Roles(UserRole.SELLER)
  @Put('me')
  async updateMyCatalog(
    @CurrentUser() user: any,
    @Body() updateCatalogDto: UpdateCatalogDto,
  ) {
    return this.catalogService.update(user.organizationId, updateCatalogDto);
  }

  @ApiOperation({ summary: 'Add category to catalog' })
  @Roles(UserRole.SELLER)
  @Post('me/categories')
  async addCategory(
    @CurrentUser() user: any,
    @Body() body: { category: string },
  ) {
    return this.catalogService.addCategory(user.organizationId, body.category);
  }

  @ApiOperation({ summary: 'Add grade to catalog' })
  @Roles(UserRole.SELLER)
  @Post('me/grades')
  async addGrade(
    @CurrentUser() user: any,
    @Body() body: { code: string; name: string; description?: string },
  ) {
    return this.catalogService.addGrade(user.organizationId, body);
  }

  @ApiOperation({ summary: 'Get catalog by organization ID (Public)' })
  @Get('org/:orgId')
  async getCatalogByOrgId(@Param('orgId') orgId: string) {
    return this.catalogService.getByOrganizationId(orgId);
  }

  @ApiOperation({ summary: 'Search catalogs by category/grade' })
  @Get('search')
  async searchCatalogs(
    @Query('category') category?: string,
    @Query('grade') grade?: string,
  ) {
    return this.catalogService.search({ category, grade });
  }
}
