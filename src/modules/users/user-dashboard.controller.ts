import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDashboardService } from './services/user-dashboard.service';

@Controller('user/dashboard')
@UseGuards(JwtAuthGuard)
export class UserDashboardController {
  constructor(private readonly dashboardService: UserDashboardService) {}

  @Get('stats')
  async getDashboardStats(@Req() req: any) {
    const userRole = req.user.role;
    const orgId = req.user.organizationId;
    return this.dashboardService.getStats(userRole, orgId);
  }

  @Get('activity')
  async getDashboardActivity(@Req() req: any) {
    const userRole = req.user.role;
    const orgId = req.user.organizationId;
    const userId = req.user.userId;
    return this.dashboardService.getActivityFeed(userRole, orgId, userId);
  }
}
