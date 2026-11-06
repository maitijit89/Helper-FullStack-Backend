import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SentEmailRecord extends EmailOptions {
  sentAt: Date;
}

class EmailService {
  private transporter: Transporter | null = null;
  public mockInbox: SentEmailRecord[] = [];

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      try {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });
        logger.info(`SMTP Transporter initialized for host: ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      } catch (err: any) {
        logger.warn(`Failed to initialize SMTP transporter: ${err.message}. Using console/memory fallback.`);
      }
    } else {
      logger.info('SMTP not configured or in test/dev mode. Emails will be logged to console/memory.');
    }
  }

  async sendMail(options: EmailOptions): Promise<boolean> {
    const record: SentEmailRecord = {
      ...options,
      sentAt: new Date(),
    };

    // Always keep in test/dev memory store
    this.mockInbox.push(record);
    if (this.mockInbox.length > 100) {
      this.mockInbox.shift();
    }

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.SMTP_FROM,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        logger.info(`Email sent successfully to ${options.to}: "${options.subject}"`);
        return true;
      } catch (err: any) {
        logger.error(`Error sending email via SMTP to ${options.to}: ${err.message}`);
        return false;
      }
    }

    // Console fallback
    logger.info(`[MOCK EMAIL DISPATCH] To: ${options.to} | Subject: ${options.subject} | Text: ${options.text}`);
    return true;
  }

  async sendRegistrationOtp(email: string, name: string, otp: string): Promise<boolean> {
    const subject = `${otp} is your Helping Services verification code`;
    const text = `Hi ${name},\n\nThank you for signing up for Helping Services. Your one-time verification code is:\n\n${otp}\n\nThis code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes. If you did not request this, please ignore this email.\n\nBest regards,\nHelping Services Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Helping Services</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for signing up. Please enter the following 6-digit code to verify your email and complete your registration:</p>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border-radius: 6px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 14px;">This code will expire in <strong>${env.OTP_EXPIRES_IN_MINUTES} minutes</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Helping Services &bull; Student & Campus Ecosystem</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }

  async sendLoginOtp(email: string, otp: string): Promise<boolean> {
    const subject = `${otp} is your Helping Services Login OTP`;
    const text = `Hello,\n\nYour login code for Helping Services is: ${otp}\n\nThis code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes.\n\nBest regards,\nHelping Services Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Helping Services</h2>
        <p>Hello,</p>
        <p>Your one-time login code is:</p>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border-radius: 6px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 14px;">This code is valid for <strong>${env.OTP_EXPIRES_IN_MINUTES} minutes</strong>. Never share this code with anyone.</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }

  async sendMobileChangeOtp(email: string, newMobile: string, otp: string): Promise<boolean> {
    const subject = `${otp} is your verification code to update mobile number`;
    const text = `Hello,\n\nYou requested to change your Helping Services registered mobile number to: ${newMobile}.\n\nYour verification code is: ${otp}\n\nValid for ${env.OTP_EXPIRES_IN_MINUTES} minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Helping Services</h2>
        <p>Hello,</p>
        <p>You requested to update your registered mobile number to: <strong>${newMobile}</strong>.</p>
        <p>Enter the verification code below to confirm this change:</p>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border-radius: 6px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 14px;">If you did not request this change, please ignore this email or secure your account.</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }

  async sendRegistrationReminder(email: string, name: string, freshOtp: string): Promise<boolean> {
    const subject = `Complete your Helping Services registration!`;
    const text = `Hi ${name},\n\nWe noticed you started creating your Helping Services account but haven't verified your email yet.\n\nYour new verification code is: ${freshOtp}\n\nOpen the app and enter this code to activate your account and access campus services.\n\nHelping Services Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Helping Services</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>You're almost there! We noticed you started signing up for Helping Services but haven't verified your email yet.</p>
        <p>Here is your new one-time code to complete your registration:</p>
        <div style="background-color: #eff6ff; border: 1px dashed #3b82f6; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1d4ed8; border-radius: 6px; margin: 24px 0;">
          ${freshOtp}
        </div>
        <p style="color: #475569; font-size: 14px;">Open the app and verify your code now to unlock access to all campus services.</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }

  getLatestEmailFor(email: string): SentEmailRecord | undefined {
    return [...this.mockInbox].reverse().find(m => m.to.toLowerCase() === email.toLowerCase());
  }

  clearMockInbox(): void {
    this.mockInbox = [];
  }
}

export const emailService = new EmailService();
