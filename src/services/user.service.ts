import crypto from 'crypto';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { OtpVerification } from '../models/OtpVerification';
import { emailService } from './email.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../middlewares/errorHandler';
import {
  CompleteProfileInput,
  UpdateProfileInput,
} from '../schemas/user.schema';

export class UserService {
  public generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  /**
   * Complete profile: fill up weight, height, course (PG or UG), department
   */
  async completeProfile(userId: string, input: CompleteProfileInput): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found.');
    }

    user.height = input.height;
    user.weight = input.weight;
    user.course = input.course;
    user.department = input.department.trim();
    user.isProfileComplete = true;

    await user.save();
    return user;
  }

  /**
   * Update profile fields:
   * - user can change name
   * - user can change DOB
   * - user can change gender
   * - user can change addresses, college, height, weight, course, department
   * - user CANNOT change registered email
   * - user CANNOT change mobile directly (must use mobile change OTP flow)
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<IUser> {
    // Explicit business rule checks
    if (input.email !== undefined) {
      throw new BadRequestException('Registered email cannot be changed.');
    }

    if (input.mobile !== undefined) {
      throw new BadRequestException(
        'Mobile number cannot be changed directly. Use /api/v1/users/mobile/request-otp to change mobile using email OTP.'
      );
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found.');
    }

    if (input.name) user.name = input.name.trim();
    if (input.dob) user.dob = new Date(input.dob);
    if (input.gender) user.gender = input.gender;
    if (input.currentAddress) user.currentAddress = input.currentAddress.trim();
    if (input.permanentAddress) user.permanentAddress = input.permanentAddress.trim();
    if (input.collegeName) user.collegeName = input.collegeName.trim();
    if (input.height !== undefined) user.height = input.height;
    if (input.weight !== undefined) user.weight = input.weight;
    if (input.course) user.course = input.course;
    if (input.department) user.department = input.department.trim();

    // Recheck profile completion if all 4 required complete-profile fields exist
    if (user.height && user.weight && user.course && user.department) {
      user.isProfileComplete = true;
    }

    await user.save();
    return user;
  }

  /**
   * Step 1 of Mobile Change: Send OTP to registered email
   */
  async requestMobileChangeOtp(user: IUser, newMobile: string): Promise<{ message: string }> {
    const formattedNewMobile = newMobile.trim();

    if (user.mobile === formattedNewMobile) {
      throw new BadRequestException('New mobile number must be different from current mobile number.');
    }

    // Check if new mobile is already taken by another account
    const existing = await User.findOne({
      mobile: formattedNewMobile,
      _id: { $ne: user._id },
      isDeleted: false,
    });

    if (existing) {
      throw new ConflictException('This mobile number is already in use by another account.');
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    await OtpVerification.findOneAndUpdate(
      { identifier: (user._id as any).toString(), purpose: 'change_mobile' },
      {
        identifier: (user._id as any).toString(),
        purpose: 'change_mobile',
        otp,
        payload: { newMobile: formattedNewMobile },
        expiresAt,
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send OTP to registered email
    await emailService.sendMobileChangeOtp(user.email, formattedNewMobile, otp);

    return {
      message: `Verification OTP has been sent to your registered email (${user.email}) to confirm the mobile number change.`,
    };
  }

  /**
   * Step 2 of Mobile Change: Verify OTP sent to email and update mobile
   */
  async verifyMobileChangeOtp(user: IUser, otp: string): Promise<{ user: IUser; message: string }> {
    const record = await OtpVerification.findOne({
      identifier: (user._id as any).toString(),
      purpose: 'change_mobile',
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Mobile verification OTP has expired or was not requested.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (record.otp !== otp.trim()) {
      record.attempts += 1;
      await record.save();
      throw new BadRequestException('Invalid OTP code.');
    }

    const newMobile = record.payload?.newMobile;
    if (!newMobile) {
      throw new BadRequestException('Invalid mobile change session.');
    }

    user.mobile = newMobile;
    await user.save();

    await OtpVerification.deleteOne({ _id: record._id });

    return {
      user,
      message: 'Mobile number updated successfully.',
    };
  }

  /**
   * Delete account (soft delete)
   */
  async deleteAccount(user: IUser): Promise<{ message: string }> {
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    // Clean up any pending OTPs for this user
    await OtpVerification.deleteMany({ identifier: (user._id as any).toString() });

    return { message: 'Your account has been deleted successfully.' };
  }
}

export const userService = new UserService();
