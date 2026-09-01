import { AppError } from "../errors/app-error";
import type {
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
} from "../dtos/auth.dto";
import { env } from "../config/env";
import { PasswordResetTokenRepository } from "../repositories/password-reset-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { createOpaqueToken, hashOpaqueToken, hashPassword } from "../utils/auth";
import type { MailService } from "./mail/mail-service";

export class PasswordResetService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: PasswordResetTokenRepository,
    private readonly mailService: MailService,
  ) {}

  async requestReset(input: PasswordResetRequestInput) {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      return {
        delivered: true,
        previewUrl: null,
        previewToken: null,
      };
    }

    await this.tokenRepository.consumeAllForUser(user.id);

    const rawToken = createOpaqueToken(24);
    const tokenRecord = this.tokenRepository.create({
      userId: user.id,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000),
      consumedAt: null,
    });

    await this.tokenRepository.save(tokenRecord);

    const resetUrl = `${env.APP_BASE_URL}${env.PASSWORD_RESET_URL_PATH}?token=${rawToken}`;
    await this.mailService.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
    });

    return {
      delivered: true,
      previewUrl: this.mailService.mode === "console" ? resetUrl : null,
      previewToken: this.mailService.mode === "console" ? rawToken : null,
    };
  }

  async confirmReset(input: PasswordResetConfirmInput) {
    const tokenHash = hashOpaqueToken(input.token);
    const tokenRecord = await this.tokenRepository.findValidByHash(tokenHash);

    if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "The password reset token is invalid or expired.");
    }

    tokenRecord.consumedAt = new Date();
    await this.tokenRepository.save(tokenRecord);

    tokenRecord.user.passwordHash = await hashPassword(input.password);
    await this.userRepository.update(tokenRecord.user);
  }
}
