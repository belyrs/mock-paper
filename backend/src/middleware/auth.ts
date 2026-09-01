import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { getAuthCookieName, verifyAuthToken } from "../utils/auth";

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const token = request.cookies?.[getAuthCookieName()];

  if (!token) {
    return next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
  }

  try {
    request.auth = verifyAuthToken(token);
    return next();
  } catch {
    return next(new AppError(401, "INVALID_TOKEN", "The current session is invalid or expired."));
  }
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (!request.auth) {
    return next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
  }

  if (request.auth.role !== "admin") {
    return next(new AppError(403, "FORBIDDEN", "Admin access is required."));
  }

  return next();
}
