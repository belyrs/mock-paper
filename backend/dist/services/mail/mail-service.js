"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMailService = createMailService;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
class ConsoleMailService {
    mode = "console";
    async sendPasswordResetEmail(input) {
        logger_1.logger.info({
            email: input.email,
            resetUrl: input.resetUrl,
        }, "Password reset requested; using console mail provider.");
    }
}
class ResendMailService {
    mode = "resend";
    async sendPasswordResetEmail(input) {
        if (!env_1.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
        }
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: env_1.env.MAIL_FROM,
                to: [input.email],
                subject: "Reset your MockPaper password",
                html: `
          <p>Hello ${input.name},</p>
          <p>Use the link below to reset your MockPaper password:</p>
          <p><a href="${input.resetUrl}">${input.resetUrl}</a></p>
          <p>If you did not request this, you can ignore this message.</p>
        `,
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Resend request failed (${response.status}): ${body}`);
        }
    }
}
class SmtpMailService {
    mode = "smtp";
    transporter = nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_PORT === 465,
        auth: env_1.env.SMTP_USER && env_1.env.SMTP_PASS
            ? {
                user: env_1.env.SMTP_USER,
                pass: env_1.env.SMTP_PASS,
            }
            : undefined,
    });
    async sendPasswordResetEmail(input) {
        await this.transporter.sendMail({
            from: env_1.env.MAIL_FROM,
            to: input.email,
            subject: "Reset your MockPaper password",
            text: `Hello ${input.name}, use this link to reset your password: ${input.resetUrl}`,
            html: `
        <p>Hello ${input.name},</p>
        <p>Use the link below to reset your MockPaper password:</p>
        <p><a href="${input.resetUrl}">${input.resetUrl}</a></p>
        <p>If you did not request this, you can ignore this message.</p>
      `,
        });
    }
}
function createMailService() {
    if (env_1.env.MAIL_PROVIDER === "resend") {
        return new ResendMailService();
    }
    if (env_1.env.MAIL_PROVIDER === "smtp") {
        return new SmtpMailService();
    }
    return new ConsoleMailService();
}
//# sourceMappingURL=mail-service.js.map