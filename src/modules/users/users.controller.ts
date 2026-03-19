import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './services/users.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @ApiOperation({ summary: 'Update user status' })
  @UseGuards(AdminGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id', MongoIdValidationPipe) id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.updateStatus(id, isActive);
  }

  @ApiOperation({ summary: 'Reset user password' })
  @UseGuards(AdminGuard)
  @Patch(':id/reset-password')
  async resetPassword(@Param('id', MongoIdValidationPipe) id: string, @Body('newPassword') newPassword: string) {
    return this.usersService.resetPassword(id, newPassword);
  }

  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @UseGuards(AdminGuard)
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'Get user profile' })
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    console.log(" user profile", user);
    return this.usersService.findById(user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@CurrentUser() user: any, @Body() body: any) {
    const { firstName, lastName, mobile } = body;
    const updateData = { firstName, lastName, mobile };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    return this.usersService.updateUser(user.userId, updateData);
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @Get(':id')
  async getUserById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.usersService.findById(id);
  }
}
