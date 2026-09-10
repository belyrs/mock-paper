import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import type { DataSource } from "typeorm";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { AuthController } from "./controllers/auth.controller";
import { HealthController } from "./controllers/health.controller";
import { HistoricalPaperController } from "./controllers/historical-paper.controller";
import { PaperController } from "./controllers/paper.controller";
import { errorHandler } from "./middleware/error-handler";
import { buildRouter } from "./routes";
import { AuthService } from "./services/auth.service";
import { DuplicateDetectionService } from "./services/duplicate-detection.service";
import { HistoricalAnalysisService } from "./services/historical-analysis.service";
import { HistoricalPaperService } from "./services/historical-paper.service";
import { createQuestionGenerationProvider } from "./services/generation/provider-factory";
import { createMailService } from "./services/mail/mail-service";
import { PaperService } from "./services/paper.service";
import { PasswordResetService } from "./services/password-reset.service";
import { QuestionGenerationService } from "./services/question-generation.service";
import { SyllabusGroundingService } from "./services/syllabus-grounding.service";
import { openApiDocument } from "./openapi";
import { GenerationRunRepository } from "./repositories/generation-run.repository";
import { HistoricalRepository } from "./repositories/historical.repository";
import { PaperRepository } from "./repositories/paper.repository";
import { PasswordResetTokenRepository } from "./repositories/password-reset-token.repository";
import { QuestionRepository } from "./repositories/question.repository";
import { UserRepository } from "./repositories/user.repository";

export function createApp(dataSource: DataSource) {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  const allowedOrigins = new Set(
    [env.FRONTEND_URL, env.APP_BASE_URL]
      .flatMap((value) => {
        try {
          const url = new URL(value);
          const variants = [url.origin];

          if (url.hostname === "localhost") {
            variants.push(url.origin.replace("localhost", "127.0.0.1"));
          }

          if (url.hostname === "127.0.0.1") {
            variants.push(url.origin.replace("127.0.0.1", "localhost"));
          }

          return variants;
        } catch {
          return [];
        }
      })
      .filter(Boolean),
  );

  const userRepository = new UserRepository(dataSource);
  const passwordResetTokenRepository = new PasswordResetTokenRepository(
    dataSource,
  );
  const paperRepository = new PaperRepository(dataSource);
  const questionRepository = new QuestionRepository(dataSource);
  const historicalRepository = new HistoricalRepository(dataSource);
  const generationRunRepository = new GenerationRunRepository(dataSource);

  const mailService = createMailService();
  const authService = new AuthService(userRepository);
  const passwordResetService = new PasswordResetService(
    userRepository,
    passwordResetTokenRepository,
    mailService,
  );
  const questionGenerationProvider = createQuestionGenerationProvider();
  const duplicateDetectionService = new DuplicateDetectionService(
    questionRepository,
    historicalRepository,
    questionGenerationProvider,
  );
  const historicalAnalysisService = new HistoricalAnalysisService(
    historicalRepository,
  );
  const syllabusGroundingService = new SyllabusGroundingService();
  const questionGenerationService = new QuestionGenerationService(
    questionGenerationProvider,
    duplicateDetectionService,
    historicalAnalysisService,
    syllabusGroundingService,
  );
  const historicalPaperService = new HistoricalPaperService(
    historicalRepository,
  );
  const paperService = new PaperService(
    paperRepository,
    questionRepository,
    userRepository,
    questionGenerationService,
    generationRunRepository,
    dataSource,
  );

  const authController = new AuthController(authService, passwordResetService);
  const paperController = new PaperController(paperService);
  const historicalPaperController = new HistoricalPaperController(
    historicalPaperService,
  );
  const healthController = new HealthController(dataSource);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        logger.warn(
          { origin, allowedOrigins: Array.from(allowedOrigins) },
          "Rejected CORS origin.",
        );
        return callback(new Error("Origin is not allowed by CORS."));
      },
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use((request, response, next) => {
    const shouldLogRequest =
      request.method !== "OPTIONS" && request.path !== "/api/health";

    if (!shouldLogRequest) {
      return next();
    }

    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    logger.info(
      {
        requestId,
        method: request.method,
        path: request.originalUrl,
      },
      "HTTP request started.",
    );

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const payload = {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs,
        userId: request.auth?.userId ?? null,
      };

      if (response.statusCode >= 500) {
        logger.error(payload, "HTTP request completed with server error.");
      } else if (response.statusCode >= 400) {
        logger.warn(payload, "HTTP request completed with client error.");
      } else {
        logger.info(payload, "HTTP request completed.");
      }
    });

    return next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    "/api",
    buildRouter({
      authController,
      paperController,
      historicalPaperController,
      healthController,
    }),
  );

  app.use(errorHandler);

  return app;
}
