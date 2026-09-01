"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = buildRouter;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const async_handler_1 = require("../utils/async-handler");
const auth_dto_1 = require("../dtos/auth.dto");
const paper_dto_1 = require("../dtos/paper.dto");
const historical_paper_dto_1 = require("../dtos/historical-paper.dto");
const validate_1 = require("../middleware/validate");
function buildRouter(dependencies) {
    const router = (0, express_1.Router)();
    const expensiveEndpointLimiter = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
    });
    const authResetLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
    });
    router.get("/health", (0, async_handler_1.asyncHandler)(dependencies.healthController.health));
    router.post("/auth/register", (0, validate_1.validateBody)(auth_dto_1.registerSchema), (0, async_handler_1.asyncHandler)(dependencies.authController.register));
    router.post("/auth/login", (0, validate_1.validateBody)(auth_dto_1.loginSchema), (0, async_handler_1.asyncHandler)(dependencies.authController.login));
    router.get("/auth/me", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.authController.me));
    router.post("/auth/logout", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.authController.logout));
    router.post("/auth/password-reset/request", authResetLimiter, (0, validate_1.validateBody)(auth_dto_1.passwordResetRequestSchema), (0, async_handler_1.asyncHandler)(dependencies.authController.requestPasswordReset));
    router.post("/auth/password-reset/confirm", (0, validate_1.validateBody)(auth_dto_1.passwordResetConfirmSchema), (0, async_handler_1.asyncHandler)(dependencies.authController.confirmPasswordReset));
    router.get("/papers", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.paperController.list));
    router.post("/papers/generate", auth_1.requireAuth, expensiveEndpointLimiter, (0, validate_1.validateBody)(paper_dto_1.generatePaperSchema), (0, async_handler_1.asyncHandler)(dependencies.paperController.generate));
    router.get("/papers/:paperId", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.paperController.getOne));
    router.patch("/papers/:paperId", auth_1.requireAuth, (0, validate_1.validateBody)(paper_dto_1.renamePaperSchema), (0, async_handler_1.asyncHandler)(dependencies.paperController.rename));
    router.delete("/papers/:paperId", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.paperController.delete));
    router.post("/papers/:paperId/regenerate", auth_1.requireAuth, expensiveEndpointLimiter, (0, async_handler_1.asyncHandler)(dependencies.paperController.regeneratePaper));
    router.patch("/papers/:paperId/questions/:questionId", auth_1.requireAuth, (0, validate_1.validateBody)(paper_dto_1.updateQuestionSchema), (0, async_handler_1.asyncHandler)(dependencies.paperController.updateQuestion));
    router.post("/papers/:paperId/questions/:questionId/regenerate", auth_1.requireAuth, expensiveEndpointLimiter, (0, async_handler_1.asyncHandler)(dependencies.paperController.regenerateQuestion));
    router.get("/historical-papers/status", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(dependencies.historicalPaperController.status));
    router.post("/historical-papers/import", auth_1.requireAuth, auth_1.requireAdmin, (0, validate_1.validateBody)(historical_paper_dto_1.importHistoricalPapersSchema), (0, async_handler_1.asyncHandler)(dependencies.historicalPaperController.import));
    return router;
}
//# sourceMappingURL=index.js.map