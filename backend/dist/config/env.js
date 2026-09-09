"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = require("dotenv");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const zod_1 = require("zod");
for (const candidate of [
    (0, node_path_1.resolve)(process.cwd(), ".env"),
    (0, node_path_1.resolve)(process.cwd(), "..", ".env"),
]) {
    if ((0, node_fs_1.existsSync)(candidate)) {
        (0, dotenv_1.config)({ path: candidate, override: false });
    }
}
const booleanish = zod_1.z
    .string()
    .optional()
    .transform((value) => {
    if (value == null || value === "")
        return undefined;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
});
const optionalPositiveInt = zod_1.z.preprocess((value) => {
    if (value == null || value === "")
        return undefined;
    return value;
}, zod_1.z.coerce.number().int().positive().optional());
const reasoningEffort = zod_1.z.enum(["none", "low", "medium", "high", "xhigh"]);
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(["development", "test", "production"])
        .default("development"),
    BACKEND_PORT: zod_1.z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: zod_1.z.string().default("http://localhost:3000"),
    APP_BASE_URL: zod_1.z.string().default("http://localhost:3000"),
    AUTH_COOKIE_SECURE: booleanish,
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    DATABASE_SYNCHRONIZE: booleanish,
    DATABASE_RUN_MIGRATIONS_ON_START: booleanish,
    DATABASE_SSL: booleanish,
    DATABASE_CONNECT_MAX_RETRIES: zod_1.z.coerce.number().int().positive().default(15),
    DATABASE_CONNECT_RETRY_DELAY_MS: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(2000),
    JWT_SECRET: zod_1.z.string().min(1, "JWT_SECRET is required"),
    JWT_EXPIRES_IN: zod_1.z.string().default("8h"),
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(30),
    PASSWORD_RESET_URL_PATH: zod_1.z.string().default("/reset-password"),
    MAIL_PROVIDER: zod_1.z.enum(["console", "resend", "smtp"]).default("console"),
    MAIL_FROM: zod_1.z.string().default("no-reply@mockpaper.local"),
    RESEND_API_KEY: zod_1.z.string().optional(),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: optionalPositiveInt,
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_BASE_URL: zod_1.z.string().default("https://api.openai.com/v1"),
    OPENAI_MODEL: zod_1.z.string().default("gpt-5.2"),
    OPENAI_REVIEW_MODEL: zod_1.z.string().default("gpt-5.2"),
    OPENAI_GENERATION_REASONING_EFFORT: reasoningEffort.default("low"),
    OPENAI_GENERATION_BATCH_SIZE: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3),
    OPENAI_GENERATION_CONCURRENCY: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(4)
        .default(3),
    OPENAI_REVIEW_REASONING_EFFORT: reasoningEffort.default("high"),
    OPENAI_REVIEW_BATCH_SIZE: zod_1.z.coerce.number().int().min(1).max(5).default(3),
    OPENAI_REVIEW_CONCURRENCY: zod_1.z.coerce.number().int().min(1).max(4).default(3),
    OPENAI_EMBEDDING_MODEL: zod_1.z.string().default("text-embedding-3-small"),
    QUESTION_PROVIDER: zod_1.z.enum(["openai", "mock"]).default("openai"),
    QUESTION_GENERATION_MAX_ATTEMPTS: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(4),
    QUESTION_GENERATION_TEMPERATURE: zod_1.z.coerce.number().min(0).max(2).default(0.4),
    SEMANTIC_DEDUP_ENABLED: booleanish,
    SEMANTIC_SIMILARITY_THRESHOLD: zod_1.z.coerce.number().min(0).max(1).default(0.92),
    DEFAULT_ADMIN_EMAIL: zod_1.z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}
exports.env = {
    ...parsed.data,
    AUTH_COOKIE_SECURE: parsed.data.AUTH_COOKIE_SECURE,
    DATABASE_SYNCHRONIZE: parsed.data.DATABASE_SYNCHRONIZE ?? false,
    DATABASE_RUN_MIGRATIONS_ON_START: parsed.data.DATABASE_RUN_MIGRATIONS_ON_START ?? true,
    DATABASE_SSL: parsed.data.DATABASE_SSL ?? false,
    SEMANTIC_DEDUP_ENABLED: parsed.data.SEMANTIC_DEDUP_ENABLED ?? true,
};
//# sourceMappingURL=env.js.map