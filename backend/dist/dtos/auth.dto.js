"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetConfirmSchema = exports.passwordResetRequestSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100),
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim()),
    password: zod_1.z.string().min(8).max(128),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim()),
    password: zod_1.z.string().min(1).max(128),
});
exports.passwordResetRequestSchema = zod_1.z.object({
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim()),
});
exports.passwordResetConfirmSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    password: zod_1.z.string().min(8).max(128),
});
//# sourceMappingURL=auth.dto.js.map