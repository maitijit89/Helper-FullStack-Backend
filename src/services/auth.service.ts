import { User, IUser, UserRole } from '../models/User';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  verifyToken,
  blacklistToken,
} from '../utils/security';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '../middlewares/errorHandler';

export interface RegisterDTO {
  email: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password?: string;
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
      throw new ConflictException('Email is already registered');
    }

    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

    const user = new User({
      email: cleanEmail,
      hashed_password: hashedPassword,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role || UserRole.USER,
      is_active: true,
      token_version: 1,
    });

    await user.save();

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async login(data: LoginDTO): Promise<{ user: IUser; tokens: AuthTokens }> {
    const cleanEmail = data.email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+hashed_password');

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    if (!user.hashed_password || !data.password) {
      throw new BadRequestException('Password required for authentication');
    }

    const valid = await verifyPassword(data.password, user.hashed_password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.token_version !== undefined && payload.token_version !== undefined && payload.token_version < user.token_version) {
      throw new UnauthorizedException('Token revoked');
    }

    return this.generateTokens(user);
  }

  async logout(user: IUser, token?: string): Promise<void> {
    user.token_version = (user.token_version || 1) + 1;
    user.last_logout_at = new Date();
    await user.save();

    if (token) {
      await blacklistToken(token, 86400 * 7);
    }
  }

  async changePassword(user: IUser, oldPass: string, newPass: string): Promise<void> {
    const u = await User.findById(user._id).select('+hashed_password');
    if (!u) throw new NotFoundException('User not found');

    if (u.hashed_password) {
      const valid = await verifyPassword(oldPass, u.hashed_password);
      if (!valid) throw new BadRequestException('Incorrect current password');
    }

    u.hashed_password = await hashPassword(newPass);
    u.token_version = (u.token_version || 1) + 1;
    u.last_logout_at = new Date();
    await u.save();
  }

  generateTokens(user: IUser): AuthTokens {
    const sub = user._id.toString();
    const tokenVersion = user.token_version || 1;

    const access_token = createAccessToken({
      sub,
      role: user.role,
      token_version: tokenVersion,
    });

    const refresh_token = createRefreshToken({
      sub,
      role: user.role,
      token_version: tokenVersion,
    });

    return {
      access_token,
      refresh_token,
      token_type: 'bearer',
    };
  }
}

export const authService = new AuthService();
