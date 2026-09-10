import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", ".env"),
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, override: false });
  }
}

const booleanish = z
  .string()
  .optional()
  .transform((value) => {
    if (value == null || value === "") return undefined;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const optionalPositiveInt = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return value;
}, z.coerce.number().int().positive().optional());

const optionalNonnegativeInt = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return value;
}, z.coerce.number().int().min(0).optional());

const reasoningEffort = z.enum(["none", "low", "medium", "high", "xhigh"]);
const authCookieSameSite = z.enum(["auto", "lax", "strict", "none"]);

const runtimeEnv = {
  ...process.env,
  // Platforms such as Railway provide PORT rather than an app-specific port.
  BACKEND_PORT: process.env.BACKEND_PORT || process.env.PORT,
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  BACKEND_PUBLIC_URL: z.string().optional(),
  API_DOCS_PUBLIC_URL: z.string().optional(),
  AUTH_COOKIE_SECURE: booleanish,
  AUTH_COOKIE_SAME_SITE: authCookieSameSite.default("auto"),
  TRUST_PROXY_HOPS: optionalNonnegativeInt.pipe(
    z.number().int().min(0).max(10).optional(),
  ),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SYNCHRONIZE: booleanish,
  DATABASE_RUN_MIGRATIONS_ON_START: booleanish,
  DATABASE_SSL: booleanish,
  DATABASE_CONNECT_MAX_RETRIES: z.coerce.number().int().positive().default(15),
  DATABASE_CONNECT_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  PASSWORD_RESET_URL_PATH: z.string().default("/reset-password"),
  MAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  MAIL_FROM: z.string().default("no-reply@mockpaper.local"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: optionalPositiveInt,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-5.2"),
  OPENAI_REVIEW_MODEL: z.string().default("gpt-5.2"),
  OPENAI_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5000)
    .max(180000)
    .default(60000),
  OPENAI_GENERATION_REASONING_EFFORT: reasoningEffort.default("low"),
  OPENAI_GENERATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(25)
    .default(20),
  OPENAI_GENERATION_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(4)
    .default(3),
  OPENAI_REVIEW_REASONING_EFFORT: reasoningEffort.default("high"),
  OPENAI_REVIEW_BATCH_SIZE: z.coerce.number().int().min(1).max(5).default(3),
  OPENAI_REVIEW_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(3),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  QUESTION_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
  DEMO_FAST_GENERATION: booleanish,
  QUESTION_GENERATION_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(2),
  QUESTION_GENERATION_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.4),
  ACADEMIC_REVIEW_ENABLED: booleanish,
  SEMANTIC_DEDUP_ENABLED: booleanish,
  SEMANTIC_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.92),
  DEFAULT_ADMIN_EMAIL: z.string().optional(),
});

const parsed = envSchema.safeParse(runtimeEnv);

if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

const demoFastGeneration = parsed.data.DEMO_FAST_GENERATION ?? true;

export const env = {
  ...parsed.data,
  AUTH_COOKIE_SECURE: parsed.data.AUTH_COOKIE_SECURE,
  TRUST_PROXY_HOPS:
    parsed.data.TRUST_PROXY_HOPS ??
    (parsed.data.NODE_ENV === "production" ? 1 : 0),
  DATABASE_SYNCHRONIZE: parsed.data.DATABASE_SYNCHRONIZE ?? false,
  DATABASE_RUN_MIGRATIONS_ON_START:
    parsed.data.DATABASE_RUN_MIGRATIONS_ON_START ?? true,
  DATABASE_SSL: parsed.data.DATABASE_SSL ?? false,
  DEMO_FAST_GENERATION: demoFastGeneration,
  OPENAI_GENERATION_BATCH_SIZE: demoFastGeneration
    ? Math.max(parsed.data.OPENAI_GENERATION_BATCH_SIZE, 20)
    : parsed.data.OPENAI_GENERATION_BATCH_SIZE,
  QUESTION_GENERATION_MAX_ATTEMPTS: demoFastGeneration
    ? Math.min(parsed.data.QUESTION_GENERATION_MAX_ATTEMPTS, 2)
    : parsed.data.QUESTION_GENERATION_MAX_ATTEMPTS,
  ACADEMIC_REVIEW_ENABLED: demoFastGeneration
    ? false
    : (parsed.data.ACADEMIC_REVIEW_ENABLED ?? true),
  SEMANTIC_DEDUP_ENABLED: demoFastGeneration
    ? false
    : (parsed.data.SEMANTIC_DEDUP_ENABLED ?? true),
} as const;
