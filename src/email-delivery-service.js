import nodemailer from 'nodemailer';
import { logger } from './logger.js';

export class EmailDeliveryService {
  constructor(config = {}) {
    this.transporter = config.host ? nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.secure || false,
      auth: {
        user: config.user,
        pass: config.pass
      }
    }) : null;
    
    this.from = config.from || 'pr-review-agent@example.com';
  }

  async sendEmail(to, subject, text, html = null) {
    if (!this.transporter) {
      logger.warn('Email delivery service not configured. Simulation mode.');
      logger.info(`EMAIL to ${to}: ${subject}\n${text}`);
      return { status: 'simulated' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>')
      });
      return { status: 'sent', messageId: info.messageId };
    } catch (e) {
      logger.error(`Failed to send email to ${to}: ${e.message}`);
      return { status: 'failed', error: e.message };
    }
  }

  formatNotificationEmail(notification) {
    const subject = `[PR Review Agent] ${notification.title}`;
    const text = `
Hello,

You have a new notification from the PR Review Agent:

${notification.message}

Priority: ${notification.priority}
Time: ${notification.created_at}

Best regards,
PR Review Agent
    `.trim();

    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
  <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">${notification.title}</h2>
  <p style="font-size: 16px; color: #34495e;">${notification.message}</p>
  <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin-top: 20px;">
    <p style="margin: 5px 0;"><strong>Priority:</strong> ${notification.priority}</p>
    <p style="margin: 5px 0;"><strong>Time:</strong> ${notification.created_at}</p>
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

export const emailDeliveryService = new EmailDeliveryService();
export default emailDeliveryService;
