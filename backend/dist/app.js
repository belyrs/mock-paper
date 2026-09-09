"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_crypto_1 = require("node:crypto");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const auth_controller_1 = require("./controllers/auth.controller");
const health_controller_1 = require("./controllers/health.controller");
const historical_paper_controller_1 = require("./controllers/historical-paper.controller");
const paper_controller_1 = require("./controllers/paper.controller");
const error_handler_1 = require("./middleware/error-handler");
const routes_1 = require("./routes");
const auth_service_1 = require("./services/auth.service");
const duplicate_detection_service_1 = require("./services/duplicate-detection.service");
const historical_analysis_service_1 = require("./services/historical-analysis.service");
const historical_paper_service_1 = require("./services/historical-paper.service");
const provider_factory_1 = require("./services/generation/provider-factory");
const mail_service_1 = require("./services/mail/mail-service");
const paper_service_1 = require("./services/paper.service");
const password_reset_service_1 = require("./services/password-reset.service");
const question_generation_service_1 = require("./services/question-generation.service");
const syllabus_grounding_service_1 = require("./services/syllabus-grounding.service");
const openapi_1 = require("./openapi");
const generation_run_repository_1 = require("./repositories/generation-run.repository");
const historical_repository_1 = require("./repositories/historical.repository");
const paper_repository_1 = require("./repositories/paper.repository");
const password_reset_token_repository_1 = require("./repositories/password-reset-token.repository");
const question_repository_1 = require("./repositories/question.repository");
const user_repository_1 = require("./repositories/user.repository");
function createApp(dataSource) {
    const app = (0, express_1.default)();
    app.set("trust proxy", env_1.env.TRUST_PROXY_HOPS);
    const allowedOrigins = new Set([env_1.env.FRONTEND_URL, env_1.env.APP_BASE_URL]
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
        }
        catch {
            return [];
        }
    })
        .filter(Boolean));
    const userRepository = new user_repository_1.UserRepository(dataSource);
    const passwordResetTokenRepository = new password_reset_token_repository_1.PasswordResetTokenRepository(dataSource);
    const paperRepository = new paper_repository_1.PaperRepository(dataSource);
    const questionRepository = new question_repository_1.QuestionRepository(dataSource);
    const historicalRepository = new historical_repository_1.HistoricalRepository(dataSource);
    const generationRunRepository = new generation_run_repository_1.GenerationRunRepository(dataSource);
    const mailService = (0, mail_service_1.createMailService)();
    const authService = new auth_service_1.AuthService(userRepository);
    const passwordResetService = new password_reset_service_1.PasswordResetService(userRepository, passwordResetTokenRepository, mailService);
    const questionGenerationProvider = (0, provider_factory_1.createQuestionGenerationProvider)();
    const duplicateDetectionService = new duplicate_detection_service_1.DuplicateDetectionService(questionRepository, historicalRepository, questionGenerationProvider);
    const historicalAnalysisService = new historical_analysis_service_1.HistoricalAnalysisService(historicalRepository);
    const syllabusGroundingService = new syllabus_grounding_service_1.SyllabusGroundingService();
    const questionGenerationService = new question_generation_service_1.QuestionGenerationService(questionGenerationProvider, duplicateDetectionService, historicalAnalysisService, syllabusGroundingService);
    const historicalPaperService = new historical_paper_service_1.HistoricalPaperService(historicalRepository);
    const paperService = new paper_service_1.PaperService(paperRepository, questionRepository, userRepository, questionGenerationService, generationRunRepository);
    const authController = new auth_controller_1.AuthController(authService, passwordResetService);
    const paperController = new paper_controller_1.PaperController(paperService);
    const historicalPaperController = new historical_paper_controller_1.HistoricalPaperController(historicalPaperService);
    const healthController = new health_controller_1.HealthController(dataSource);
    app.use((0, cors_1.default)({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true);
            }
            logger_1.logger.warn({ origin, allowedOrigins: Array.from(allowedOrigins) }, "Rejected CORS origin.");
            return callback(new Error("Origin is not allowed by CORS."));
        },
        credentials: true,
    }));
    app.use((0, helmet_1.default)());
    app.use((request, response, next) => {
        const shouldLogRequest = request.method !== "OPTIONS" && request.path !== "/api/health";
        if (!shouldLogRequest) {
            return next();
        }
        const requestId = (0, node_crypto_1.randomUUID)().slice(0, 8);
        const startedAt = Date.now();
        logger_1.logger.info({
            requestId,
            method: request.method,
            path: request.originalUrl,
        }, "HTTP request started.");
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
                logger_1.logger.error(payload, "HTTP request completed with server error.");
            }
            else if (response.statusCode >= 400) {
                logger_1.logger.warn(payload, "HTTP request completed with client error.");
            }
            else {
                logger_1.logger.info(payload, "HTTP request completed.");
            }
        });
        return next();
    });
    app.use(express_1.default.json({ limit: "2mb" }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.openApiDocument));
    app.use("/api", (0, routes_1.buildRouter)({
        authController,
        paperController,
        historicalPaperController,
        healthController,
    }));
    app.use(error_handler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map