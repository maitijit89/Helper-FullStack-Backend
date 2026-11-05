import { Response } from "express";

export interface ApiResponseOptions<T> {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface StandardApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export const sendResponse = <T>(
  res: Response,
  options: ApiResponseOptions<T>,
): Response => {
  const { statusCode = 200, message, data, meta } = options;

  const payload: StandardApiResponse<T> = {
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  };

  return res.status(statusCode).json(payload);
};
