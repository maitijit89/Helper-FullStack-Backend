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
    if (await isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked/logged out');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      throw new UnauthorizedException(`Invalid token: ${err.message}`);
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid token claims');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Inactive user account');
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
    if (await isTokenBlacklisted(token)) {
      return next();
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next();
    }

    if (payload.type !== 'access' || !payload.sub) {
      return next();
    }

    const user = await User.findById(payload.sub);
    if (user && user.is_active) {
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
    if (!roles.includes(req.user.role)) {
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
  if (req.user.role !== UserRole.PARTNER) {
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
