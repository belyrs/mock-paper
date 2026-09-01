import { buildDataSource } from "./config/data-source";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createApp } from "./app";

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

  for (let attempt = 1; attempt <= env.DATABASE_CONNECT_MAX_RETRIES; attempt += 1) {
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
  logger.info(
    {
      backendPort: env.BACKEND_PORT,
      frontendUrl: env.FRONTEND_URL,
      questionProvider: env.QUESTION_PROVIDER,
      openAiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    },
    "Backend startup initiated.",
  );

  const dataSource = await initializeDataSource();
  const app = createApp(dataSource);
  app.listen(env.BACKEND_PORT, () => {
    logger.info(
      {
        port: env.BACKEND_PORT,
        apiUrl: `http://localhost:${env.BACKEND_PORT}/api`,
        docsUrl: `http://localhost:${env.BACKEND_PORT}/api-docs`,
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
