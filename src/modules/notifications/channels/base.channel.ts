import { Injectable } from '@nestjs/common';

export interface NotificationPayload {
  to: string;
  subject?: string;
  title: string;
  message: string;
  template?: string;
  data?: any;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
}

@Injectable()
export abstract class BaseNotificationChannel {
  abstract type: string;
  abstract send(payload: NotificationPayload): Promise<void>;
}
