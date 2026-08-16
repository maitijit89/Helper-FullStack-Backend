import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.SMTP_USER && env.SMTP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });
    }
  }

  async sendEmail(to: string, subject: string, htmlContent: string, textContent?: string): Promise<boolean> {
    if (!this.transporter) {
      logger.warn(`SMTP credentials not configured. Email to ${to} not sent. Subject: ${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: `"${env.EMAILS_FROM_NAME}" <${env.EMAILS_FROM_EMAIL}>`,
        to,
        subject,
        html: htmlContent,
        text: textContent || htmlContent.replace(/<[^>]*>?/gm, ''),
      });
      logger.info(`Email successfully sent to: ${to}`);
      return true;
    } catch (err: any) {
      logger.error(`Error sending email to ${to}: ${err.message}`);
      return false;
    }
  }

  async sendOTPEmail(to: string, otpCode: string, purpose: string): Promise<boolean> {
    const subject = `Your Verification Code - ${env.PROJECT_NAME}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">${env.PROJECT_NAME}</h2>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p>Hello,</p>
        <p>You requested a one-time verification code for <strong>${purpose}</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="text-align: center; color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} ${env.PROJECT_NAME}. All rights reserved.</p>
      </div>
    `;
    return this.sendEmail(to, subject, htmlContent);
  }
}

export const emailService = new EmailService();
