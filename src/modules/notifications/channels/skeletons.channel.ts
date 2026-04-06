import { Injectable } from '@nestjs/common';
import { BaseNotificationChannel, NotificationPayload } from './base.channel';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@Injectable()
export class SmsNotificationChannel extends BaseNotificationChannel {
  type = 'SMS';

  constructor(private readonly logger: CustomLoggerService) {
    super();
  }

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.log(`[SMS-SKELETON] Sending to ${payload.to}: ${payload.message}`);
    // Future: Integrate Twilio/MessageBird here
  }
}

@Injectable()
export class WhatsappNotificationChannel extends BaseNotificationChannel {
  type = 'WHATSAPP';

  constructor(private readonly logger: CustomLoggerService) {
    super();
  }

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.log(`[WHATSAPP-SKELETON] Sending to ${payload.to}: ${payload.message}`);
    // Future: Integrate WhatsApp Business API here
  }
}
