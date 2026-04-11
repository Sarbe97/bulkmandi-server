import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { BaseNotificationChannel, NotificationPayload } from './base.channel';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@Injectable()
export class EmailNotificationChannel extends BaseNotificationChannel {
  type = 'EMAIL';
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLoggerService,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: this.configService.get<number>('MAIL_PORT') === 465,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async send(payload: NotificationPayload): Promise<void> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const testMode = this.configService.get<boolean>('TEST_MODE');
    const subjectPrefix = (!isProd || testMode) ? '[TEST] ' : '';
    const finalSubject = `${subjectPrefix}${payload.subject || payload.title}`;

    let html = payload.message;

    // 1. Template Rendering
    if (payload.template) {
      try {
        const possibleDirs = [
          path.join(process.cwd(), 'src', 'templates', 'notifications'),
          path.join(process.cwd(), 'dist', 'src', 'templates', 'notifications'),
          path.join(process.cwd(), 'dist', 'templates', 'notifications'),
          path.join(process.cwd(), 'templates', 'notifications'),
          path.join(__dirname, '..', '..', '..', 'templates', 'notifications'),
        ];

        let templatesDir = '';
        for (const d of possibleDirs) {
          if (fs.existsSync(d)) {
            templatesDir = d;
            break;
          }
        }

        if (templatesDir) {
          const templatePath = path.join(templatesDir, `${payload.template}.hbs`);
          const layoutPath = path.join(templatesDir, 'layout.hbs');

          if (fs.existsSync(templatePath)) {
            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const emailTemplate = handlebars.compile(templateContent);
            const bodyHtml = emailTemplate(payload.data || {});

            if (fs.existsSync(layoutPath)) {
              const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
              const layoutTemplate = handlebars.compile(layoutContent);
              html = layoutTemplate({ ...payload.data, body: bodyHtml, title: payload.title });
            } else {
              html = bodyHtml;
            }
          }
        } else {
          this.logger.warn(`Could not find templates directory for ${payload.template}`);
        }
      } catch (err) {
        this.logger.error(`Error rendering email template ${payload.template}: ${err.message}`);
        // Fallback to plain message if template fails
      }
    }

    // 2. Attachments Handling
    const attachments = (payload.attachments || []).map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
    }));

    // 3. Logo Embedding (Branding)
    const logoPath = path.join(process.cwd(), 'assets/bm-logo.png');
    if (fs.existsSync(logoPath)) {
        attachments.push({
            filename: 'bm-logo.png',
            path: logoPath,
            cid: 'logo' // referenced in layout.hbs: <img src="cid:logo" ... />
        } as any);
    }

    const testRecipient = 'sarbe85@gmail.com'; // ✅ Hardcoded for testing as per user request

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to: testRecipient,
        subject: finalSubject,
        html,
        attachments,
      });
      this.logger.log(`Email sent successfully to ${testRecipient} (Original: ${payload.to})`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${testRecipient} (Original: ${payload.to}): ${err.message}`);
      throw new InternalServerErrorException(`Email dispatch failed: ${err.message}`);
    }
  }
}
