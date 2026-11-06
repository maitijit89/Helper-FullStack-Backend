import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { PendingRegistration, IPendingRegistration } from '../models/PendingRegistration';
import { OtpVerification } from '../models/OtpVerification';
import { emailService } from './email.service';
import { redisService } from './redis.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../middlewares/errorHandler';
import {
  RegisterInput,
  VerifyRegistrationOtpInput,
  LoginVerifyOtpInput,
} from '../schemas/auth.schema';

export class AuthService {
  /**
   * Generates a cryptographically secure 6-digit numeric OTP
   */
  public generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Step 1: User fills up registration details.
   * If not yet verified with OTP, stored as PendingRegistration so user is NOT active yet.
   */
  async register(input: RegisterInput): Promise<{ email: string; message: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedMobile = input.mobile.trim();

    // Check if user already exists and is active
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { mobile: normalizedMobile }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new ConflictException('An account with this email is already registered.');
      }
      throw new ConflictException('An account with this mobile number is already registered.');
    }

    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    // Upsert pending registration draft
    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name: input.name.trim(),
        email: normalizedEmail,
        mobile: normalizedMobile,
        dob: new Date(input.dob),
        gender: input.gender,
        currentAddress: input.currentAddress.trim(),
        permanentAddress: input.permanentAddress.trim(),
        collegeName: input.collegeName.trim(),
        otp,
        otpExpiresAt,
        otpAttempts: 0,
        lastReminderSentAt: new Date(),
        reminderCount: 0,
        status: 'pending',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Dispatch OTP email
    await emailService.sendRegistrationOtp(normalizedEmail, input.name, otp);

    return {
      email: normalizedEmail,
      message: 'Registration initiated. Verification OTP has been sent to your email.',
    };
  }

  /**
   * Step 2: User verifies email OTP to complete registration.
   * Activates user in User collection and issues JWT token.
   */
  async verifyRegistrationOtp(
    input: VerifyRegistrationOtpInput
  ): Promise<{ token: string; user: IUser }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail,
      status: 'pending',
    });

    if (!pending) {
      throw new BadRequestException(
        'No pending registration found for this email. Please submit the registration form first.'
      );
    }

    if (pending.otpExpiresAt < new Date()) {
      throw new BadRequestException('Verification OTP has expired. Please request a new OTP.');
    }

    if (pending.otpAttempts >= 5) {
      throw new BadRequestException(
        'Maximum OTP verification attempts exceeded. Please request a new OTP.'
      );
    }

    if (pending.otp !== input.otp.trim()) {
      pending.otpAttempts += 1;
      await pending.save();
      throw new BadRequestException('Invalid OTP code. Please enter the correct code.');
    }

    // Double check email uniqueness before final creation
    const emailConflict = await User.findOne({ email: normalizedEmail });
    if (emailConflict) {
      throw new ConflictException('An account with this email is already registered.');
    }

    // Officially register the user
    const newUser = await User.create({
      name: pending.name,
      email: pending.email,
      mobile: pending.mobile,
      dob: pending.dob,
      gender: pending.gender,
      currentAddress: pending.currentAddress,
      permanentAddress: pending.permanentAddress,
      collegeName: pending.collegeName,
      role: 'user',
      isVerified: true,
      isProfileComplete: false,
    });

    // Mark pending registration as completed
    pending.status = 'completed';
    await pending.save();

    const token = this.generateToken(newUser);

    return { token, user: newUser };
  }

  /**
   * Resend verification OTP for pending registration
   */
  async resendRegistrationOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail,
      status: 'pending',
    });

    if (!pending) {
      throw new NotFoundException('No pending registration found for this email.');
    }

    const otp = this.generateOtp();
    pending.otp = otp;
    pending.otpExpiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);
    pending.otpAttempts = 0;
    await pending.save();

    await emailService.sendRegistrationOtp(pending.email, pending.name, otp);

    return { message: 'A fresh verification OTP has been sent to your email.' };
  }

  /**
   * Step 1 Login: User enters registered email to request OTP
   */
  async requestLoginOtp(email: string): Promise<{ email: string; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (!user) {
      throw new NotFoundException(
        'No registered account found with this email. Please register first.'
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    // Upsert login OTP
    await OtpVerification.findOneAndUpdate(
      { identifier: normalizedEmail, purpose: 'login' },
      {
        identifier: normalizedEmail,
        purpose: 'login',
        otp,
        expiresAt,
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await emailService.sendLoginOtp(normalizedEmail, otp);

    return {
      email: normalizedEmail,
      message: 'Login OTP sent to your registered email.',
    };
  }

  /**
   * Step 2 Login: User enters email + OTP to authenticate
   */
  async verifyLoginOtp(input: LoginVerifyOtpInput): Promise<{ token: string; user: IUser }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    const record = await OtpVerification.findOne({
      identifier: normalizedEmail,
      purpose: 'login',
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Login OTP has expired or was not requested.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Maximum attempts exceeded. Please request a new login OTP.');
    }

    if (record.otp !== input.otp.trim()) {
      record.attempts += 1;
      await record.save();
      throw new BadRequestException('Invalid login OTP.');
    }

    // Consume OTP
    await OtpVerification.deleteOne({ _id: record._id });

    const token = this.generateToken(user);

    return { token, user };
  }

  /**
   * Logout user by blacklisting current token
   */
  async logout(token: string): Promise<{ message: string }> {
    try {
      const decoded = jwt.decode(token) as any;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? Math.max(decoded.exp - now, 60) : 7 * 24 * 3600;
      await redisService.set(`blacklist:${token}`, '1', ttl);
    } catch {
      // Fallback: 24h
      await redisService.set(`blacklist:${token}`, '1', 86400);
    }

    return { message: 'Logged out successfully.' };
  }

  /**
   * Generate signed JWT token
   */
  public generateToken(user: IUser): string {
    return jwt.sign(
      {
        id: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      } as jwt.SignOptions
    );
  }
}

export const authService = new AuthService();
