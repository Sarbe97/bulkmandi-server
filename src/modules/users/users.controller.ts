import { Body, Controller, Get, Param, Patch, Delete, UseGuards, ConflictException, ForbiddenException, Res } from '@nestjs/common';
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

  @ApiOperation({ summary: 'Export all users to CSV' })
  @UseGuards(AdminGuard)
  @Get('export-csv')
  async exportCsv(@Res() res: any) {
    const csv = await this.usersService.downloadUsersCsv();
    const filename = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  }

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

  @ApiOperation({ summary: 'Bulk delete users (Dev mode only)' })
  @UseGuards(AdminGuard)
  @Delete('bulk-delete')
  async bulkDeleteUsers(@Body('userIds') userIds: string[]) {
    if (process.env.TEST_MODE !== 'true') {
      throw new ForbiddenException('Bulk deletion is only allowed when TEST_MODE=true in .env');
    }
    return this.usersService.bulkDelete(userIds);
  }

  @ApiOperation({ summary: 'Delete user (Dev mode only)' })
  @UseGuards(AdminGuard)
  @Delete(':id')
  async deleteUser(@Param('id', MongoIdValidationPipe) id: string) {
    if (process.env.TEST_MODE !== 'true') {
      throw new ForbiddenException('Deletion is only allowed when TEST_MODE=true in .env');
    }
    return this.usersService.deleteUser(id);
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
    try {
      const { firstName, lastName, mobile } = body;
      const updateData = { firstName, lastName, mobile };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      return await this.usersService.updateUser(user.userId, updateData);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('This mobile number is already registered to another account.');
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @Get(':id')
  async getUserById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.usersService.findById(id);
  }
}
