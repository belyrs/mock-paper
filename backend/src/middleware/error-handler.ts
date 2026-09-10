import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { toPublicError } from "../errors/public-error";
import { logger } from "../config/logger";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    const payload = {
      code: error.code,
      statusCode: error.statusCode,
      path: request.path,
      details: error.details ?? null,
    };

    if (error.statusCode >= 500) {
      logger.error(payload, "Request failed with application error.");
    } else {
      logger.warn(payload, "Request failed with application error.");
    }

    return response.status(error.statusCode).json({
      error: toPublicError(error),
    });
  }

  logger.error({ err: error, path: request.path }, "Unhandled request error");

  return response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong.",
      details: null,
    },
  });
}
