import { Body, Controller, Get, Param, Put, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreferencesService } from './preferences.service';
import { UpdateBuyerPreferenceDto, UpdateLogisticPreferenceDto, UpdateSellerPreferenceDto } from './dto/preference.dto';

@ApiTags('Preferences (Operational Config)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @ApiOperation({ summary: 'Get settings for current organization based on role' })
  @Get()
  async getMyPreferences(@CurrentUser() user: any) {
    if (!user.organizationId) throw new UnauthorizedException('User is not linked to an organization.');
    return this.preferencesService.getPreferences(user.organizationId, user.role);
  }

  @ApiOperation({ summary: 'Get settings for current organization (Buyer Alias)' })
  @Get('buyer')
  async getBuyerPreferences(@CurrentUser() user: any) {
    return this.getMyPreferences(user);
  }

  @ApiOperation({ summary: 'Get settings for current organization (Seller Alias)' })
  @Get('seller')
  async getSellerPreferences(@CurrentUser() user: any) {
    return this.getMyPreferences(user);
  }

  @ApiOperation({ summary: 'Get settings for current organization (Logistic Alias)' })
  @Get('logistic')
  async getLogisticPreferences(@CurrentUser() user: any) {
    return this.getMyPreferences(user);
  }

  @ApiOperation({ summary: 'Upsert operational preferences for a Buyer' })
  @Put('buyer')
  async updateBuyer(@CurrentUser() user: any, @Body() dto: UpdateBuyerPreferenceDto) {
    if (!user.organizationId) throw new UnauthorizedException('No organization linked.');
    return this.preferencesService.upsertBuyerPreference(user.organizationId, dto);
  }

  @ApiOperation({ summary: 'Upsert operational preferences for a Seller' })
  @Put('seller')
  async updateSeller(@CurrentUser() user: any, @Body() dto: UpdateSellerPreferenceDto) {
    if (!user.organizationId) throw new UnauthorizedException('No organization linked.');
    return this.preferencesService.upsertSellerPreference(user.organizationId, dto);
  }

  @ApiOperation({ summary: 'Upsert operational preferences for a Logistic Partner' })
  @Put('logistic')
  async updateLogistic(@CurrentUser() user: any, @Body() dto: UpdateLogisticPreferenceDto) {
    if (!user.organizationId) throw new UnauthorizedException('No organization linked.');
    return this.preferencesService.upsertLogisticPreference(user.organizationId, dto);
  }
}
