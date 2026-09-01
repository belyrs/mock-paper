import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { CookieOptions } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { User } from "../entities/user.entity";

const AUTH_COOKIE_NAME = "mockpaper_auth";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: User["role"];
}

export function getAuthCookieName() {
  return AUTH_COOKIE_NAME;
}

function usesHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function shouldUseSecureAuthCookie(): boolean {
  if (env.AUTH_COOKIE_SECURE != null) {
    return env.AUTH_COOKIE_SECURE;
  }

  return [env.APP_BASE_URL, env.FRONTEND_URL].some(usesHttps);
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureAuthCookie(),
    maxAge: 1000 * 60 * 60 * 8,
  };
}

export function getAuthClearCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = getAuthCookieOptions();
  return options;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(user: Pick<User, "id" | "email" | "role">): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}

export function createOpaqueToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
