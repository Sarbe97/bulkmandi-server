import { Controller, Get, Patch, Param, UseGuards, Req, Query, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Public()
  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const userId = req.user?.userId;
    
    // ✅ Gracefully return empty data for guests instead of 401/404
    if (!userId) {
      return {
        data: [],
        unreadCount: 0,
      };
    }

    const notifications = await this.notificationsService.findAllForUser(userId, page, limit);
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    
    return {
      data: notifications,
      unreadCount,
    };
  }

  @Public()
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) {
      return { count: 0 };
    }
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }
}
