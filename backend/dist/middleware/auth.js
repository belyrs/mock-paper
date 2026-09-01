"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const app_error_1 = require("../errors/app-error");
const auth_1 = require("../utils/auth");
function requireAuth(request, _response, next) {
    const token = request.cookies?.[(0, auth_1.getAuthCookieName)()];
    if (!token) {
        return next(new app_error_1.AppError(401, "UNAUTHORIZED", "Authentication is required."));
    }
    try {
        request.auth = (0, auth_1.verifyAuthToken)(token);
        return next();
    }
    catch {
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