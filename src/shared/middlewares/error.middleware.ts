import { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { config } from "../../config/env";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Structured logging for server errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(config.env === "development" && {
      stack: err instanceof Error ? err.stack : undefined,
    }),
  });
};

