import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { EmailNotificationChannel } from './channels/email.channel';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { SmsNotificationChannel, WhatsappNotificationChannel } from './channels/skeletons.channel';
import { UsersService } from '../users/services/users.service';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

export interface NotifyOptions {
  channels?: string[];
  template?: string;
  data?: any;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
  category?: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly emailChannel: EmailNotificationChannel,
    private readonly inAppChannel: InAppNotificationChannel,
    private readonly smsChannel: SmsNotificationChannel,
    private readonly whatsappChannel: WhatsappNotificationChannel,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Main dispatcher for all notifications.
   */
  async notify(
    userId: string,
    title: string,
    message: string,
    options: NotifyOptions = {},
  ): Promise<void> {
    this.logger.log(`Dispatching notification to user ${userId}: ${title}`);

    const user = await this.usersService.findById(userId);
    const channels = options.channels || ['IN_APP', 'EMAIL'];

    const payload = {
      to: '', // populated per channel
      subject: title,
      title,
      message,
      template: options.template,
      data: {
        ...(options.data || {}),
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        appName: 'bulkmandi',
        year: new Date().getFullYear(),
      },
      attachments: options.attachments,
    };

    const dispatchPromises = channels.map(async (channelType) => {
      try {
        if (channelType === 'IN_APP') {
          await this.inAppChannel.send({ ...payload, to: userId });
        } else if (channelType === 'EMAIL' && user.email) {
          await this.emailChannel.send({ ...payload, to: user.email });
        } else if (channelType === 'SMS' && user.mobile) {
          await this.smsChannel.send({ ...payload, to: user.mobile });
        } else if (channelType === 'WHATSAPP' && user.mobile) {
          await this.whatsappChannel.send({ ...payload, to: user.mobile });
        }
      } catch (err) {
        this.logger.error(`Failed to send ${channelType} notification to ${userId}: ${err.message}`);
      }
    });

    // Fire and forget to avoid blocking the main thread (improves performance significantly)
    Promise.all(dispatchPromises).catch(err => {
      this.logger.error(`Background notification dispatch failed: ${err.message}`);
    });
  }

  async findAllForUser(userId: string, page = 1, limit = 20) {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
  }

  async getUnreadCount(userId: string) {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAllAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    ).exec();
  }
}
