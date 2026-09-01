"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = void 0;
const app_error_1 = require("../errors/app-error");
const env_1 = require("../config/env");
const auth_1 = require("../utils/auth");
class PasswordResetService {
    userRepository;
    tokenRepository;
    mailService;
    constructor(userRepository, tokenRepository, mailService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.mailService = mailService;
    }
    async requestReset(input) {
        const user = await this.userRepository.findByEmail(input.email);
        if (!user) {
            return {
                delivered: true,
                previewUrl: null,
                previewToken: null,
            };
        }
        await this.tokenRepository.consumeAllForUser(user.id);
        const rawToken = (0, auth_1.createOpaqueToken)(24);
        const tokenRecord = this.tokenRepository.create({
            userId: user.id,
            tokenHash: (0, auth_1.hashOpaqueToken)(rawToken),
            expiresAt: new Date(Date.now() + env_1.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000),
            consumedAt: null,
        });
        await this.tokenRepository.save(tokenRecord);
        const resetUrl = `${env_1.env.APP_BASE_URL}${env_1.env.PASSWORD_RESET_URL_PATH}?token=${rawToken}`;
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
    async confirmReset(input) {
        const tokenHash = (0, auth_1.hashOpaqueToken)(input.token);
        const tokenRecord = await this.tokenRepository.findValidByHash(tokenHash);
        if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
            throw new app_error_1.AppError(400, "INVALID_RESET_TOKEN", "The password reset token is invalid or expired.");
        }
        tokenRecord.consumedAt = new Date();
        await this.tokenRepository.save(tokenRecord);
        tokenRecord.user.passwordHash = await (0, auth_1.hashPassword)(input.password);
        await this.userRepository.update(tokenRecord.user);
    }
}
exports.PasswordResetService = PasswordResetService;
//# sourceMappingURL=password-reset.service.js.map