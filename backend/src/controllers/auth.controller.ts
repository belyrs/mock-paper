import type { Request, Response } from "express";
import { serializeUser } from "../utils/serializers";
import {
  getAuthClearCookieOptions,
  getAuthCookieName,
  getAuthCookieOptions,
  signAuthToken,
} from "../utils/auth";
import type { AuthService } from "../services/auth.service";
import type { PasswordResetService } from "../services/password-reset.service";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  register = async (request: Request, response: Response) => {
    const user = await this.authService.register(request.body);
    response.cookie(getAuthCookieName(), signAuthToken(user), getAuthCookieOptions());
    response.status(201).json({ user: serializeUser(user) });
  };

  login = async (request: Request, response: Response) => {
    const user = await this.authService.login(request.body);
    response.cookie(getAuthCookieName(), signAuthToken(user), getAuthCookieOptions());
    response.json({ user: serializeUser(user) });
  };

  me = async (request: Request, response: Response) => {
    const user = await this.authService.me(request.auth!.userId);
    response.json({ user: serializeUser(user) });
  };

  logout = async (_request: Request, response: Response) => {
    response.clearCookie(getAuthCookieName(), getAuthClearCookieOptions());
    response.status(204).send();
  };

  requestPasswordReset = async (request: Request, response: Response) => {
    const reset = await this.passwordResetService.requestReset(request.body);
    response.json({
      message: "If an account exists for that email, a password reset flow has been started.",
      reset,
    });
  };

  confirmPasswordReset = async (request: Request, response: Response) => {
    await this.passwordResetService.confirmReset(request.body);
    response.status(204).send();
  };
}
