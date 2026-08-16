import { User, IUser, UserRole, PartnerVerificationStatus } from '../models/User';
import { OTPPurpose } from '../models/OTP';
import { PartnerWallet } from '../models/PartnerWallet';
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, verifyToken, blacklistToken } from '../utils/security';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '../middlewares/errorHandler';
import { otpService } from './otp.service';
import { env } from '../config/env';

export interface RegisterDTO {
  email: string;
  password?: string;
  code?: string;
  otp?: string;
  full_name?: string;
  phone?: string;
  role?: UserRole;
  dob?: string;
  gender?: any;
  college?: string;
  address?: string;
}

export interface LoginDTO {
  email: string;
  password?: string;
  code?: string;
  otp?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

class AuthService {
  async register(data: RegisterDTO): Promise<{ user: IUser; tokens: AuthTokens }> {
    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const otpCode = data.code || data.otp;
    let isEmailVerified = false;
    if (otpCode) {
      await otpService.verifyOTP(cleanEmail, otpCode, OTPPurpose.REGISTRATION);
      isEmailVerified = true;
    }

    const hashedPassword = data.password ? await hashPassword(data.password) : undefined;
    const isSuperuser = cleanEmail === env.ADMIN_EMAIL.toLowerCase();
    const role = isSuperuser ? UserRole.ADMIN : data.role || UserRole.USER;

    const user = new User({
      email: cleanEmail,
      hashed_password: hashedPassword,
      full_name: data.full_name,
      phone: data.phone,
      role,
      dob: data.dob,
      gender: data.gender,
      college: data.college,
      address: data.address,
      is_superuser: isSuperuser,
      is_email_verified: isEmailVerified,
      is_active: true,
      partner_profile:
        role === UserRole.PARTNER
          ? {
              verification_status: PartnerVerificationStatus.PENDING,
              is_online: false,
            }
          : undefined,
    });

    await user.save();

    // If partner, initialize wallet
    if (role === UserRole.PARTNER) {
      const wallet = new PartnerWallet({
        partner_id: user._id.toString(),
        total_balance: 0,
        pending_withdrawal_balance: 0,
        total_withdrawn: 0,
      });
      await wallet.save();
    }

    const tokens = this.generateAuthTokens(user._id.toString(), user.role);
    return { user, tokens };
  }

  async login(
    emailOrData: string | LoginDTO,
    maybePassword?: string,
    maybeCode?: string
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    let email = '';
    let password = maybePassword;
    let otpCode = maybeCode;

    if (typeof emailOrData === 'object') {
      email = emailOrData.email;
      password = emailOrData.password;
      otpCode = emailOrData.code || emailOrData.otp;
    } else {
      email = emailOrData;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Mode A: OTP verification code provided
    if (otpCode) {
      await otpService.verifyOTP(cleanEmail, otpCode, OTPPurpose.LOGIN);

      let user = await User.findOne({ email: cleanEmail });
      if (!user) {
        // Auto-create user on passwordless OTP login
        const isSuperuser = cleanEmail === env.ADMIN_EMAIL.toLowerCase();
        user = new User({
          email: cleanEmail,
          role: isSuperuser ? UserRole.ADMIN : UserRole.USER,
          is_superuser: isSuperuser,
          is_email_verified: true,
          is_active: true,
        });
        await user.save();
      } else {
        if (!user.is_active) {
          throw new UnauthorizedException('User account is inactive');
        }
        if (!user.is_email_verified) {
          user.is_email_verified = true;
          await user.save();
        }
      }

      const tokens = this.generateAuthTokens(user._id.toString(), user.role);
      return { user, tokens };
    }

    // Mode B: Password provided
    if (password) {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        throw new UnauthorizedException('Incorrect email or password');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('User account is inactive');
      }

      if (!user.hashed_password) {
        throw new BadRequestException('No password set for this account. Please log in using Email OTP.');
      }

      const isMatch = await verifyPassword(password, user.hashed_password);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect email or password');
      }

      const tokens = this.generateAuthTokens(user._id.toString(), user.role);
      return { user, tokens };
    }

    throw new BadRequestException('Either password or OTP verification code is required to log in');
  }

  async verifyOTPAndLogin(
    email: string,
    code: string,
    purpose: OTPPurpose = OTPPurpose.LOGIN
  ): Promise<{ user: IUser; tokens: AuthTokens; message: string }> {
    const cleanEmail = email.toLowerCase().trim();
    await otpService.verifyOTP(cleanEmail, code, purpose);

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      const isSuperuser = cleanEmail === env.ADMIN_EMAIL.toLowerCase();
      user = new User({
        email: cleanEmail,
        role: isSuperuser ? UserRole.ADMIN : UserRole.USER,
        is_superuser: isSuperuser,
        is_email_verified: true,
        is_active: true,
      });
      await user.save();
    } else {
      if (!user.is_active) {
        throw new UnauthorizedException('User account is inactive');
      }
      if (!user.is_email_verified) {
        user.is_email_verified = true;
        await user.save();
      }
    }

    const tokens = this.generateAuthTokens(user._id.toString(), user.role);
    return {
      user,
      tokens,
      message: 'OTP verified successfully. Authenticated.',
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = verifyToken(refreshToken);
      if (payload.type !== 'refresh' || !payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await User.findById(payload.sub);
      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateAuthTokens(user._id.toString(), user.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(token: string): Promise<void> {
    try {
      const payload = verifyToken(token);
      const remainingSeconds = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 1800;
      await blacklistToken(token, remainingSeconds);
    } catch {
      // ignore
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Security best practice: don't disclose user existence
      return { message: 'If the email exists, a password reset code has been sent.' };
    }
    await otpService.sendOTP(email, OTPPurpose.PASSWORD_RESET);
    return { message: 'Password reset code has been sent to your email.' };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    await otpService.verifyOTP(email, code, OTPPurpose.PASSWORD_RESET);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.hashed_password = await hashPassword(newPassword);
    user.touch();
    await user.save();
    return { message: 'Password has been reset successfully.' };
  }

  generateAuthTokens(userId: string, role: UserRole): AuthTokens {
    return {
      access_token: createAccessToken(userId, role),
      refresh_token: createRefreshToken(userId, role),
      token_type: 'bearer',
    };
  }
}

export const authService = new AuthService();
