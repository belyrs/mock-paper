"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const serializers_1 = require("../utils/serializers");
const auth_1 = require("../utils/auth");
class AuthController {
    authService;
    passwordResetService;
    constructor(authService, passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
    }
    register = async (request, response) => {
        const user = await this.authService.register(request.body);
        response.cookie((0, auth_1.getAuthCookieName)(), (0, auth_1.signAuthToken)(user), (0, auth_1.getAuthCookieOptions)());
        response.status(201).json({ user: (0, serializers_1.serializeUser)(user) });
    };
    login = async (request, response) => {
        const user = await this.authService.login(request.body);
        response.cookie((0, auth_1.getAuthCookieName)(), (0, auth_1.signAuthToken)(user), (0, auth_1.getAuthCookieOptions)());
        response.json({ user: (0, serializers_1.serializeUser)(user) });
    };
    me = async (request, response) => {
        const user = await this.authService.me(request.auth.userId);
        response.json({ user: (0, serializers_1.serializeUser)(user) });
    };
    logout = async (_request, response) => {
        response.clearCookie((0, auth_1.getAuthCookieName)(), (0, auth_1.getAuthClearCookieOptions)());
        response.status(204).send();
    };
    requestPasswordReset = async (request, response) => {
        const reset = await this.passwordResetService.requestReset(request.body);
        response.json({
            message: "If an account exists for that email, a password reset flow has been started.",
            reset,
        });
    };
    confirmPasswordReset = async (request, response) => {
        await this.passwordResetService.confirmReset(request.body);
        response.status(204).send();
    };
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map