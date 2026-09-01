import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export interface PasswordResetMailInput {
  email: string;
  name: string;
  resetUrl: string;
}

export interface MailService {
  readonly mode: "console" | "resend" | "smtp";
  sendPasswordResetEmail(input: PasswordResetMailInput): Promise<void>;
}

class ConsoleMailService implements MailService {
  readonly mode = "console" as const;

  async sendPasswordResetEmail(input: PasswordResetMailInput): Promise<void> {
    logger.info(
      {
        email: input.email,
        resetUrl: input.resetUrl,
      },
      "Password reset requested; using console mail provider.",
    );
  }
}

class ResendMailService implements MailService {
  readonly mode = "resend" as const;

  async sendPasswordResetEmail(input: PasswordResetMailInput): Promise<void> {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
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

class SmtpMailService implements MailService {
  readonly mode = "smtp" as const;
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  async sendPasswordResetEmail(input: PasswordResetMailInput): Promise<void> {
    await this.transporter.sendMail({
      from: env.MAIL_FROM,
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

export function createMailService(): MailService {
  if (env.MAIL_PROVIDER === "resend") {
    return new ResendMailService();
  }

  if (env.MAIL_PROVIDER === "smtp") {
    return new SmtpMailService();
  }

  return new ConsoleMailService();
}
