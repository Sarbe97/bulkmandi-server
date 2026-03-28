import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDashboardService } from './services/user-dashboard.service';

@Controller('v1/user/dashboard')
@UseGuards(JwtAuthGuard)
export class UserDashboardController {
  constructor(private readonly dashboardService: UserDashboardService) {}

  @Get('stats')
  async getDashboardStats(@Req() req: any) {
    const userRole = req.user.role;
    const orgId = req.user.organizationId;
    return this.dashboardService.getStats(userRole, orgId);
  }
}
