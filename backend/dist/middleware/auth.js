"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const logger_1 = require("../config/logger");
const app_error_1 = require("../errors/app-error");
const auth_1 = require("../utils/auth");
function requireAuth(request, _response, next) {
    const token = request.cookies?.[(0, auth_1.getAuthCookieName)()];
    if (!token) {
        logger_1.logger.warn({
            method: request.method,
            path: request.originalUrl,
            origin: request.get("origin") ?? null,
            hasCookieHeader: Boolean(request.get("cookie")),
            receivedCookieNames: Object.keys(request.cookies ?? {}),
        }, "Authentication cookie was not received.");
        return next(new app_error_1.AppError(401, "UNAUTHORIZED", "Authentication is required."));
    }
    try {
        request.auth = (0, auth_1.verifyAuthToken)(token);
        return next();
    }
    catch (error) {
        logger_1.logger.warn({
            method: request.method,
            path: request.originalUrl,
            tokenError: error instanceof Error ? error.message : "Unknown token error",
        }, "Authentication cookie was received but could not be verified.");
        return next(new app_error_1.AppError(401, "INVALID_TOKEN", "The current session is invalid or expired."));
    }
}
function requireAdmin(request, _response, next) {
    if (!request.auth) {
        return next(new app_error_1.AppError(401, "UNAUTHORIZED", "Authentication is required."));
    }
    if (request.auth.role !== "admin") {
        return next(new app_error_1.AppError(403, "FORBIDDEN", "Admin access is required."));
    }
    return next();
}
//# sourceMappingURL=auth.js.map