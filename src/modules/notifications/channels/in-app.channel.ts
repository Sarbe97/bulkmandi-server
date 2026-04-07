import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { BaseNotificationChannel, NotificationPayload } from './base.channel';

@Injectable()
export class InAppNotificationChannel extends BaseNotificationChannel {
  type = 'IN_APP';

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    super();
  }

  async send(payload: NotificationPayload): Promise<void> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(payload.to),
      title: payload.title,
      message: payload.message,
      type: payload.data?.type || 'INFO',
      category: payload.data?.category || 'SYSTEM',
      metadata: payload.data || {},
      channels: ['IN_APP'],
    });

    console.log(`[In-App Notification] Saved for user: ${payload.to} | Title: ${payload.title}`);
    await notification.save();
  }
}
