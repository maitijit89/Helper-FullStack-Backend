import { Request, Response, NextFunction } from 'express';
import { User, IUser, UserRole, PartnerVerificationStatus } from '../models/User';
import { verifyToken, isTokenBlacklisted } from '../utils/security';
import { UnauthorizedException, ForbiddenException } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  token?: string;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      throw new UnauthorizedException(`Invalid token: ${err.message}`);
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid token claims');
    }

    // Parallelize Redis blacklist lookup and MongoDB user query for 2x faster auth resolution
    const [isBlacklisted, user] = await Promise.all([
      isTokenBlacklisted(token),
      User.findById(payload.sub),
    ]);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked/logged out');
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Inactive user account');
    }

    // Persistent token version check
    if (
      user.token_version !== undefined &&
      payload.token_version !== undefined &&
      payload.token_version < user.token_version
    ) {
      throw new UnauthorizedException('Token has been revoked/logged out');
    }

    // Check last logout timestamp against token issued_at (iat)
    if (user.last_logout_at && payload.iat) {
      const issuedAtMs = payload.iat * 1000;
      const lastLogoutMs = user.last_logout_at.getTime();
      // Allow 2000ms clock skew tolerance between token issuance and DB commit
      if (issuedAtMs < lastLogoutMs - 2000) {
        throw new UnauthorizedException('Session has expired. Please log in again.');
      }
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next();
    }

    if (payload.type !== 'access' || !payload.sub) {
      return next();
    }

    const [isBlacklisted, user] = await Promise.all([
      isTokenBlacklisted(token),
      User.findById(payload.sub),
    ]);

    if (isBlacklisted) {
      return next();
    }

    if (user && user.is_active) {
      if (
        user.token_version !== undefined &&
        payload.token_version !== undefined &&
        payload.token_version < user.token_version
      ) {
        return next();
      }
      if (user.last_logout_at && payload.iat && payload.iat * 1000 < user.last_logout_at.getTime() - 2000) {
        return next();
      }
      req.user = user;
      req.token = token;
    }
    next();
  } catch {
    next();
  }
}

export function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedException());
    }
    if (req.user.is_superuser) {
      return next();
    }
    const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    const isSuper = req.user.role === UserRole.SUPER || req.user.getAccountType() === 'super';

    const hasRole =
      roles.includes(req.user.role) ||
      userRoles.some((r) => roles.includes(r as UserRole)) ||
      (isSuper && (roles.includes(UserRole.USER) || roles.includes(UserRole.PARTNER)));

    if (!hasRole) {
      return next(new ForbiddenException(`Access forbidden. Requires one of roles: ${roles.join(', ')}`));
    }
    next();
  };
}

export function requirePartnerApproved(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedException());
  }
  if (req.user.is_superuser) {
    return next();
  }
  const isPartner =
    req.user.role === UserRole.PARTNER ||
    req.user.role === UserRole.SUPER ||
    (req.user.roles && req.user.roles.includes(UserRole.PARTNER)) ||
    req.user.getAccountType() === 'super' ||
    req.user.getAccountType() === 'partner';

  if (!isPartner) {
    return next(new ForbiddenException('Access restricted to delivery partners'));
  }
  if (!req.user.partner_profile) {
    return next(new ForbiddenException('Partner profile missing'));
  }
  if (req.user.partner_profile.verification_status !== PartnerVerificationStatus.APPROVED) {
    return next(new ForbiddenException(`Partner account is not approved. Current status: ${req.user.partner_profile.verification_status}`));
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedException());
  }
  if (req.user.is_superuser || req.user.role === UserRole.ADMIN) {
    return next();
  }
  return next(new ForbiddenException('Access restricted to administrators'));
}

export function requireActiveGPS(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedException());
  }
  if (!req.user.is_gps_enabled || !req.user.location) {
    return next(new ForbiddenException('GPS / Location services must be enabled on your device to perform this operation.'));
  }
  next();
}
