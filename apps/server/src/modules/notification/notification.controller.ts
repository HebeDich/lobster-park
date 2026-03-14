import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('isRead') isRead?: string, @Query('eventType') eventType?: string) {
    this.authService.requirePermission(currentUser, 'notification.view');
    return this.notificationService.listNotifications(currentUser, { pageNo: Number(pageNo), pageSize: Number(pageSize), isRead, eventType });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, 'notification.view');
    return this.notificationService.getUnreadCount(currentUser);
  }

  @Patch(':notificationId/read')
  markRead(@CurrentUser() currentUser: RequestUserContext, @Param('notificationId') notificationId: string) {
    this.authService.requirePermission(currentUser, 'notification.view');
    return this.notificationService.markRead(currentUser, notificationId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, 'notification.view');
    return this.notificationService.markAllRead(currentUser);
  }
}
