import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { PendingRegistration, IPendingRegistration } from '../models/PendingRegistration';
import { emailService } from './email.service';

export interface ReminderRunResult {
  processedCount: number;
  remindedEmails: string[];
}

export class RegistrationReminderService {
  private timer: NodeJS.Timeout | null = null;

  public generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Scans pending registrations that have not verified their OTP,
   * finds those whose last reminder/submission was >= 3 days ago,
   * and drops a reminder email with a fresh OTP.
   */
  async processPendingReminders(): Promise<ReminderRunResult> {
    const reminderDays = env.REGISTRATION_REMINDER_DAYS || 3;
    const cutoffDate = new Date(Date.now() - reminderDays * 24 * 60 * 60 * 1000);

    const pendingList: IPendingRegistration[] = await PendingRegistration.find({
      status: 'pending',
      lastReminderSentAt: { $lte: cutoffDate },
    });

    const remindedEmails: string[] = [];

    for (const pending of pendingList) {
      try {
        const freshOtp = this.generateOtp();
        pending.otp = freshOtp;
        pending.otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour window for reminder OTP
        pending.otpAttempts = 0;
        pending.lastReminderSentAt = new Date();
        pending.reminderCount += 1;

        await pending.save();

        await emailService.sendRegistrationReminder(pending.email, pending.name, freshOtp);
        remindedEmails.push(pending.email);

        logger.info(
          `Dropped 3-day registration reminder email to ${pending.email} (Reminder #${pending.reminderCount})`
        );
      } catch (err: any) {
        logger.error(`Failed to send registration reminder to ${pending.email}: ${err.message}`);
      }
    }

    return {
      processedCount: remindedEmails.length,
      remindedEmails,
    };
  }

  /**
   * Starts an in-process background worker that runs periodically (e.g., every 6 hours)
   */
  startScheduler(intervalMs: number = 6 * 60 * 60 * 1000): void {
    if (this.timer) {
      return;
    }

    logger.info(`Starting Registration Reminder Scheduler (interval: ${intervalMs / 1000}s)`);

    // Run first check after 10 seconds of startup
    setTimeout(() => {
      this.processPendingReminders().catch((err) => {
        logger.error(`Error in initial reminder job run: ${err.message}`);
      });
    }, 10000);

    this.timer = setInterval(() => {
      this.processPendingReminders().catch((err) => {
        logger.error(`Error in periodic reminder job: ${err.message}`);
      });
    }, intervalMs);

    // Ensure timer doesn't prevent process from exiting
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped Registration Reminder Scheduler');
    }
  }
}

export const reminderService = new RegistrationReminderService();
