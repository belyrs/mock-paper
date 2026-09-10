import { buildDataSource } from "./config/data-source";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createApp } from "./app";
import { getAuthCookieOptions } from "./utils/auth";

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function initializeDataSource() {
  let lastError: unknown = null;
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseTarget = {
    host: databaseUrl.hostname,
    port: databaseUrl.port || "5432",
    database: databaseUrl.pathname.replace(/^\//, ""),
    ssl: env.DATABASE_SSL,
  };

  for (
    let attempt = 1;
    attempt <= env.DATABASE_CONNECT_MAX_RETRIES;
    attempt += 1
  ) {
    const dataSource = buildDataSource();

    try {
      logger.info(
        {
          attempt,
          maxAttempts: env.DATABASE_CONNECT_MAX_RETRIES,
          ...databaseTarget,
        },
        "Attempting database connection.",
      );

      await dataSource.initialize();
      logger.info(databaseTarget, "Database connection established.");

      if (env.DATABASE_RUN_MIGRATIONS_ON_START) {
        logger.info("Running pending database migrations.");
        await dataSource.runMigrations();
        logger.info("Database migrations completed.");
      }

      return dataSource;
    } catch (error) {
      lastError = error;
      await dataSource.destroy().catch(() => undefined);

      if (attempt >= env.DATABASE_CONNECT_MAX_RETRIES) {
        break;
      }

      logger.warn(
        {
          attempt,
          maxAttempts: env.DATABASE_CONNECT_MAX_RETRIES,
          retryDelayMs: env.DATABASE_CONNECT_RETRY_DELAY_MS,
          err: error,
        },
        "Database connection failed. Retrying.",
      );

      await sleep(env.DATABASE_CONNECT_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Database initialization failed after all retry attempts.");
}

async function start() {
  const authCookieOptions = getAuthCookieOptions();
  logger.info(
    {
      backendPort: env.BACKEND_PORT,
      backendPublicUrl: env.BACKEND_PUBLIC_URL ?? null,
      frontendUrl: env.FRONTEND_URL,
      questionProvider: env.QUESTION_PROVIDER,
      openAiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
      demoFastGeneration: env.DEMO_FAST_GENERATION,
      generationBatchSize: env.OPENAI_GENERATION_BATCH_SIZE,
      generationMaxAttempts: env.QUESTION_GENERATION_MAX_ATTEMPTS,
      openAiRequestTimeoutMs: env.OPENAI_REQUEST_TIMEOUT_MS,
      academicReviewEnabled: env.ACADEMIC_REVIEW_ENABLED,
      semanticDedupEnabled: env.SEMANTIC_DEDUP_ENABLED,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      authCookieSecure: authCookieOptions.secure,
      authCookieSameSite: authCookieOptions.sameSite,
      authCookiePartitioned: authCookieOptions.partitioned,
    },
    "Backend startup initiated.",
  );

  const dataSource = await initializeDataSource();
  const app = createApp(dataSource);
  app.listen(env.BACKEND_PORT, () => {
    logger.info(
      {
        port: env.BACKEND_PORT,
        apiUrl:
          env.BACKEND_PUBLIC_URL ?? `http://localhost:${env.BACKEND_PORT}/api`,
        docsUrl:
          env.API_DOCS_PUBLIC_URL ??
          `http://localhost:${env.BACKEND_PORT}/api-docs`,
        nodeEnv: env.NODE_ENV,
      },
      "MockPaper backend is ready.",
    );
  });
}

void start().catch((error) => {
  logger.error({ err: error }, "Failed to start backend.");
  process.exit(1);
});
