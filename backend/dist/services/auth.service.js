"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const app_error_1 = require("../errors/app-error");
const auth_1 = require("../utils/auth");
const env_1 = require("../config/env");
class AuthService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async register(input) {
        const existing = await this.userRepository.findByEmail(input.email);
        if (existing) {
            throw new app_error_1.AppError(409, "EMAIL_ALREADY_IN_USE", "An account with this email already exists.");
        }
        const passwordHash = await (0, auth_1.hashPassword)(input.password);
        const userCount = await this.userRepository.count();
        const isAdmin = userCount === 0 || (env_1.env.DEFAULT_ADMIN_EMAIL && env_1.env.DEFAULT_ADMIN_EMAIL === input.email);
        return this.userRepository.save({
            name: input.name,
            email: input.email,
            passwordHash,
            role: isAdmin ? "admin" : "user",
        });
    }
    async login(input) {
        const user = await this.userRepository.findByEmail(input.email);
        if (!user) {
            throw new app_error_1.AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
        const passwordMatches = await (0, auth_1.verifyPassword)(input.password, user.passwordHash);
        if (!passwordMatches) {
            throw new app_error_1.AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
        return user;
    }
    async me(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new app_error_1.AppError(401, "USER_NOT_FOUND", "The signed-in account could not be found.");
        }
        return user;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map