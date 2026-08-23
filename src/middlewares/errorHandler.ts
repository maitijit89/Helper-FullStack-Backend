import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundException extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedException extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenException extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class BadRequestException extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, details);
  }
}

export class ConflictException extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      detail: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    const errorDetails = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    const firstErrorMessage = errorDetails[0]?.message || 'Validation error';
    res.status(422).json({
      success: false,
      message: firstErrorMessage,
      detail: firstErrorMessage,
      errors: errorDetails,
    });
    return;
  }

  // Handle body-parser JSON syntax/parse errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON payload. Please check your request body syntax.',
      detail: err.message,
    });
    return;
  }

  // Handle generic errors with explicit HTTP status codes
  if (err.statusCode && typeof err.statusCode === 'number' && err.statusCode < 500) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message || 'Client error',
      detail: err.message || 'Client error',
    });
    return;
  }

  logger.error(`Unhandled exception on ${req.method} ${req.url}:`, err);

  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = isProd ? 'Internal server error' : (err.message || 'Internal server error');

  res.status(500).json({
    success: false,
    message: errorMessage,
    detail: errorMessage,
  });
}
