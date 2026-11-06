import { User, IUser, UserRole, PartnerVerificationStatus } from '../models/User';
import { OTPPurpose } from '../models/OTP';
import { PartnerWallet } from '../models/PartnerWallet';
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, verifyToken, blacklistToken } from '../utils/security';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '../middlewares/errorHandler';
import { otpService } from './otp.service';
import { env } from '../config/env';
import { wsManager } from './websocket.service';

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
    const otpCode = data.code || data.otp;
    const requestedRole = data.role || UserRole.USER;
    const isSuperuser = cleanEmail === env.ADMIN_EMAIL.toLowerCase();

    if (existing) {
      const existingRoles =
        existing.roles && existing.roles.length > 0 ? existing.roles : [existing.role || UserRole.USER];

      const alreadyHasRole = existingRoles.includes(requestedRole) || existing.role === UserRole.SUPER;

      if (alreadyHasRole) {
        throw new ConflictException(`Email already registered as a ${existing.getAccountType()} account`);
      }

      if (!otpCode) {
        throw new BadRequestException('OTP verification code is required to link and upgrade your account');
      }

      await otpService.verifyOTP(cleanEmail, otpCode, OTPPurpose.REGISTRATION);

      if (!existingRoles.includes(requestedRole)) {
        existingRoles.push(requestedRole);
      }
      existing.roles = Array.from(new Set(existingRoles));

      if (existing.roles.includes(UserRole.USER) && existing.roles.includes(UserRole.PARTNER)) {
        existing.role = UserRole.SUPER;
      }

      if (data.full_name && !existing.full_name) existing.full_name = data.full_name;
      if (data.phone && !existing.phone) existing.phone = data.phone;
      if (data.dob && !existing.dob) existing.dob = data.dob;
      if (data.gender && !existing.gender) existing.gender = data.gender;
      if (data.college && !existing.college) existing.college = data.college;
      if (data.address && !existing.address) existing.address = data.address;

      if (data.password && !existing.hashed_password) {
        existing.hashed_password = await hashPassword(data.password);
      }

      if (requestedRole === UserRole.PARTNER || existing.roles.includes(UserRole.PARTNER)) {
        if (!existing.partner_profile) {
          existing.partner_profile = {
            verification_status: PartnerVerificationStatus.PENDING,
            is_online: false,
          };
        }
        const existingWallet = await PartnerWallet.findOne({ partner_id: existing._id.toString() });
        if (!existingWallet) {
          const wallet = new PartnerWallet({
            partner_id: existing._id.toString(),
            total_balance: 0,
            pending_withdrawal_balance: 0,
            total_withdrawn: 0,
          });
          await wallet.save();
        }
      }

      existing.touch();
      await existing.save();

      const tokens = this.generateAuthTokens(
        existing._id.toString(),
        existing.role,
        existing.roles,
        existing.getAccountType(),
        existing.token_version
      );
      return { user: existing, tokens };
    }

    if (!otpCode) {
      throw new BadRequestException('OTP verification code is required to complete registration');
    }

    await otpService.verifyOTP(cleanEmail, otpCode, OTPPurpose.REGISTRATION);

    const hashedPassword = data.password ? await hashPassword(data.password) : undefined;
    const role = isSuperuser ? UserRole.ADMIN : requestedRole;
    const roles = isSuperuser ? [UserRole.ADMIN] : [role];

    const user = new User({
      email: cleanEmail,
      hashed_password: hashedPassword,
      full_name: data.full_name,
      phone: data.phone,
      role,
      roles,
      dob: data.dob,
      gender: data.gender,
      college: data.college,
      address: data.address,
      is_superuser: isSuperuser,
      is_email_verified: true,
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

    const tokens = this.generateAuthTokens(
      user._id.toString(),
      user.role,
      user.roles,
      user.getAccountType(),
      user.token_version
    );
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

      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        throw new NotFoundException('Account not found with this email. Please complete registration first.');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('User account is inactive');
      }

      if (!user.is_email_verified) {
        user.is_email_verified = true;
        await user.save();
      }

      const tokens = this.generateAuthTokens(
        user._id.toString(),
        user.role,
        user.roles,
        user.getAccountType(),
        user.token_version
      );
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

      if (!user.is_email_verified) {
        throw new UnauthorizedException('Email is not verified. Please complete OTP verification before logging in.');
      }

      if (!user.hashed_password) {
        throw new BadRequestException('No password set for this account. Please log in using Email OTP.');
      }

      const isMatch = await verifyPassword(password, user.hashed_password);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect email or password');
      }

      const tokens = this.generateAuthTokens(
        user._id.toString(),
        user.role,
        user.roles,
        user.getAccountType(),
        user.token_version
      );
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

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      throw new NotFoundException('User account not found. Please complete registration first.');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (!user.is_email_verified) {
      user.is_email_verified = true;
      await user.save();
    }

    const tokens = this.generateAuthTokens(
      user._id.toString(),
      user.role,
      user.roles,
      user.getAccountType(),
      user.token_version
    );
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

      return this.generateAuthTokens(
        user._id.toString(),
        user.role,
        user.roles,
        user.getAccountType(),
        user.token_version
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(token?: string, user?: IUser, refreshToken?: string): Promise<void> {
    let targetUser = user;

    if (token) {
      try {
        const payload = verifyToken(token);
        const remainingSeconds = payload.exp
          ? Math.max(1, payload.exp - Math.floor(Date.now() / 1000))
          : 1800;
        // Cap Redis TTL at 1 year (31,536,000 seconds)
        await blacklistToken(token, Math.min(remainingSeconds, 31536000));

        if (!targetUser && payload.sub) {
          targetUser = (await User.findById(payload.sub)) || undefined;
        }
      } catch {
        // ignore invalid/expired token during blacklist
      }
    }

    if (refreshToken) {
      try {
        const refreshPayload = verifyToken(refreshToken);
        const remainingSeconds = refreshPayload.exp
          ? Math.max(1, refreshPayload.exp - Math.floor(Date.now() / 1000))
          : 1800;
        await blacklistToken(refreshToken, Math.min(remainingSeconds, 31536000));

        if (!targetUser && refreshPayload.sub) {
          targetUser = (await User.findById(refreshPayload.sub)) || undefined;
        }
      } catch {
        // ignore
      }
    }

    if (targetUser) {
      targetUser.last_logout_at = new Date();
      targetUser.token_version = (targetUser.token_version || 0) + 1;

      // Delivery partner cleanup: set offline on logout so no orders ring
      if (targetUser.partner_profile) {
        targetUser.partner_profile.is_online = false;
      }

      targetUser.touch();
      await targetUser.save();

      // Disconnect active partner WebSocket connection
      wsManager.disconnectPartner(targetUser._id.toString());
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

  generateAuthTokens(
    userId: string,
    role: string = UserRole.USER,
    roles?: string[],
    accountType?: string,
    tokenVersion?: number
  ): AuthTokens {
    const isPartner =
      role === UserRole.PARTNER ||
      role === UserRole.SUPER ||
      (roles && roles.includes(UserRole.PARTNER)) ||
      accountType === 'partner' ||
      accountType === 'super';

    // 1-Year session (365 days = 525,600 minutes) for partners
    const accessExpiryMinutes = isPartner
      ? env.PARTNER_ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60
      : undefined;

    const refreshExpiryDays = isPartner
      ? env.PARTNER_REFRESH_TOKEN_EXPIRE_DAYS
      : undefined;

    return {
      access_token: createAccessToken(userId, role, accessExpiryMinutes, roles, accountType, tokenVersion),
      refresh_token: createRefreshToken(userId, role, refreshExpiryDays, roles, accountType, tokenVersion),
      token_type: 'bearer',
    };
  }
}

export const authService = new AuthService();
