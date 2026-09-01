import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthController } from "../controllers/auth.controller";
import type { HealthController } from "../controllers/health.controller";
import type { HistoricalPaperController } from "../controllers/historical-paper.controller";
import type { PaperController } from "../controllers/paper.controller";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
} from "../dtos/auth.dto";
import {
  generatePaperSchema,
  renamePaperSchema,
  updateQuestionSchema,
} from "../dtos/paper.dto";
import { importHistoricalPapersSchema } from "../dtos/historical-paper.dto";
import { validateBody } from "../middleware/validate";

interface BuildRouterDependencies {
  authController: AuthController;
  paperController: PaperController;
  historicalPaperController: HistoricalPaperController;
  healthController: HealthController;
}

export function buildRouter(dependencies: BuildRouterDependencies) {
  const router = Router();
  const expensiveEndpointLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get("/health", asyncHandler(dependencies.healthController.health));

  router.post("/auth/register", validateBody(registerSchema), asyncHandler(dependencies.authController.register));
  router.post("/auth/login", validateBody(loginSchema), asyncHandler(dependencies.authController.login));
  router.get("/auth/me", requireAuth, asyncHandler(dependencies.authController.me));
  router.post("/auth/logout", requireAuth, asyncHandler(dependencies.authController.logout));
  router.post(
    "/auth/password-reset/request",
    authResetLimiter,
    validateBody(passwordResetRequestSchema),
    asyncHandler(dependencies.authController.requestPasswordReset),
  );
  router.post(
    "/auth/password-reset/confirm",
    validateBody(passwordResetConfirmSchema),
    asyncHandler(dependencies.authController.confirmPasswordReset),
  );

  router.get("/papers", requireAuth, asyncHandler(dependencies.paperController.list));
  router.post(
    "/papers/generate",
    requireAuth,
    expensiveEndpointLimiter,
    validateBody(generatePaperSchema),
    asyncHandler(dependencies.paperController.generate),
  );
  router.get("/papers/:paperId", requireAuth, asyncHandler(dependencies.paperController.getOne));
  router.patch(
    "/papers/:paperId",
    requireAuth,
    validateBody(renamePaperSchema),
    asyncHandler(dependencies.paperController.rename),
  );
  router.delete("/papers/:paperId", requireAuth, asyncHandler(dependencies.paperController.delete));
  router.post(
    "/papers/:paperId/regenerate",
    requireAuth,
    expensiveEndpointLimiter,
    asyncHandler(dependencies.paperController.regeneratePaper),
  );
  router.patch(
    "/papers/:paperId/questions/:questionId",
    requireAuth,
    validateBody(updateQuestionSchema),
    asyncHandler(dependencies.paperController.updateQuestion),
  );
  router.post(
    "/papers/:paperId/questions/:questionId/regenerate",
    requireAuth,
    expensiveEndpointLimiter,
    asyncHandler(dependencies.paperController.regenerateQuestion),
  );

  router.get(
    "/historical-papers/status",
    requireAuth,
    asyncHandler(dependencies.historicalPaperController.status),
  );
  router.post(
    "/historical-papers/import",
    requireAuth,
    requireAdmin,
    validateBody(importHistoricalPapersSchema),
    asyncHandler(dependencies.historicalPaperController.import),
  );

  return router;
}
