"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
const app_error_1 = require("../errors/app-error");
function validateBody(schema) {
    return (request, _response, next) => {
        const result = schema.safeParse(request.body);
        if (!result.success) {
            return next(new app_error_1.AppError(400, "VALIDATION_ERROR", "Request body validation failed.", result.error.flatten()));
        }
        request.body = result.data;
        return next();
    };
}
//# sourceMappingURL=validate.js.map