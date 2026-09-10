"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("./config/data-source");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const app_1 = require("./app");
const auth_1 = require("./utils/auth");
function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
async function initializeDataSource() {
    let lastError = null;
    const databaseUrl = new URL(env_1.env.DATABASE_URL);
    const databaseTarget = {
        host: databaseUrl.hostname,
        port: databaseUrl.port || "5432",
        database: databaseUrl.pathname.replace(/^\//, ""),
        ssl: env_1.env.DATABASE_SSL,
    };
    for (let attempt = 1; attempt <= env_1.env.DATABASE_CONNECT_MAX_RETRIES; attempt += 1) {
        const dataSource = (0, data_source_1.buildDataSource)();
        try {
            logger_1.logger.info({
                attempt,
                maxAttempts: env_1.env.DATABASE_CONNECT_MAX_RETRIES,
                ...databaseTarget,
            }, "Attempting database connection.");
            await dataSource.initialize();
            logger_1.logger.info(databaseTarget, "Database connection established.");
            if (env_1.env.DATABASE_RUN_MIGRATIONS_ON_START) {
                logger_1.logger.info("Running pending database migrations.");
                await dataSource.runMigrations();
                logger_1.logger.info("Database migrations completed.");
            }
            return dataSource;
        }
        catch (error) {
            lastError = error;
            await dataSource.destroy().catch(() => undefined);
            if (attempt >= env_1.env.DATABASE_CONNECT_MAX_RETRIES) {
                break;
            }
            logger_1.logger.warn({
                attempt,
                maxAttempts: env_1.env.DATABASE_CONNECT_MAX_RETRIES,
                retryDelayMs: env_1.env.DATABASE_CONNECT_RETRY_DELAY_MS,
                err: error,
            }, "Database connection failed. Retrying.");
            await sleep(env_1.env.DATABASE_CONNECT_RETRY_DELAY_MS);
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error("Database initialization failed after all retry attempts.");
}
async function start() {
    const authCookieOptions = (0, auth_1.getAuthCookieOptions)();
    logger_1.logger.info({
        backendPort: env_1.env.BACKEND_PORT,
        backendPublicUrl: env_1.env.BACKEND_PUBLIC_URL ?? null,
        frontendUrl: env_1.env.FRONTEND_URL,
        questionProvider: env_1.env.QUESTION_PROVIDER,
        openAiConfigured: Boolean(env_1.env.OPENAI_API_KEY?.trim()),
        demoFastGeneration: env_1.env.DEMO_FAST_GENERATION,
        generationBatchSize: env_1.env.OPENAI_GENERATION_BATCH_SIZE,
        generationMaxAttempts: env_1.env.QUESTION_GENERATION_MAX_ATTEMPTS,
        openAiRequestTimeoutMs: env_1.env.OPENAI_REQUEST_TIMEOUT_MS,
        academicReviewEnabled: env_1.env.ACADEMIC_REVIEW_ENABLED,
        semanticDedupEnabled: env_1.env.SEMANTIC_DEDUP_ENABLED,
        trustProxyHops: env_1.env.TRUST_PROXY_HOPS,
        authCookieSecure: authCookieOptions.secure,
        authCookieSameSite: authCookieOptions.sameSite,
        authCookiePartitioned: authCookieOptions.partitioned,
    }, "Backend startup initiated.");
    const dataSource = await initializeDataSource();
    const app = (0, app_1.createApp)(dataSource);
    app.listen(env_1.env.BACKEND_PORT, () => {
        logger_1.logger.info({
            port: env_1.env.BACKEND_PORT,
            apiUrl: env_1.env.BACKEND_PUBLIC_URL ?? `http://localhost:${env_1.env.BACKEND_PORT}/api`,
            docsUrl: env_1.env.API_DOCS_PUBLIC_URL ??
                `http://localhost:${env_1.env.BACKEND_PORT}/api-docs`,
            nodeEnv: env_1.env.NODE_ENV,
        }, "MockPaper backend is ready.");
    });
}
void start().catch((error) => {
    logger_1.logger.error({ err: error }, "Failed to start backend.");
    process.exit(1);
});
//# sourceMappingURL=index.js.map