"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const app_error_1 = require("../errors/app-error");
const public_error_1 = require("../errors/public-error");
const logger_1 = require("../config/logger");
function errorHandler(error, request, response, _next) {
    if (error instanceof app_error_1.AppError) {
        const payload = {
            code: error.code,
            statusCode: error.statusCode,
            path: request.path,
            details: error.details ?? null,
        };
        if (error.statusCode >= 500) {
            logger_1.logger.error(payload, "Request failed with application error.");
        }
        else {
            logger_1.logger.warn(payload, "Request failed with application error.");
        }
        return response.status(error.statusCode).json({
            error: (0, public_error_1.toPublicError)(error),
        });
    }
    logger_1.logger.error({ err: error, path: request.path }, "Unhandled request error");
    return response.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong.",
            details: null,
        },
    });
}
//# sourceMappingURL=error-handler.js.map