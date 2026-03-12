import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST');
    this.from = this.configService.get<string>('EMAIL_FROM', 'pr-review-agent@example.com');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('EMAIL_PORT', 587),
        secure: this.configService.get<boolean>('EMAIL_SECURE', false),
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASS'),
        },
      });
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<{ status: string; messageId?: string; error?: string }> {
    if (!this.transporter) {
      this.logger.warn('Email delivery service not configured. Simulation mode.');
      this.logger.log(`EMAIL to ${to}: ${subject}\n${text}`);
      return { status: 'simulated' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
      });
      return { status: 'sent', messageId: info.messageId };
    } catch (e) {
      this.logger.error(`Failed to send email to ${to}: ${e.message}`);
      return { status: 'failed', error: e.message };
    }
  }

  formatNotificationEmail(notification: any): { subject: string; text: string; html: string } {
    const subject = `[PR Review Agent] ${notification.title}`;
    const text = `
Hello,

You have a new notification from the PR Review Agent:

${notification.message}

Priority: ${notification.priority}
Time: ${notification.createdAt}

Best regards,
PR Review Agent
    `.trim();

    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
  <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">${notification.title}</h2>
  <p style="font-size: 16px; color: #34495e;">${notification.message}</p>
  <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin-top: 20px;">
    <p style="margin: 5px 0;"><strong>Priority:</strong> ${notification.priority}</p>
    <p style="margin: 5px 0;"><strong>Time:</strong> ${notification.createdAt}</p>
  </div>
  <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
    Best regards,<br>
    PR Review Agent
  </p>
</div>
    `.trim();

    return { subject, text, html };
  }
}
