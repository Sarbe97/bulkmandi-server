import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { EmailNotificationChannel } from './channels/email.channel';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { SmsNotificationChannel, WhatsappNotificationChannel } from './channels/skeletons.channel';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    forwardRef(() => UsersModule),
  ],
  providers: [
    NotificationsService,
    EmailNotificationChannel,
    InAppNotificationChannel,
    SmsNotificationChannel,
    WhatsappNotificationChannel,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
