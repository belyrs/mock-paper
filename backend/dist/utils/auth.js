"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthCookieName = getAuthCookieName;
exports.shouldUseSecureAuthCookie = shouldUseSecureAuthCookie;
exports.resolveAuthCookieSameSite = resolveAuthCookieSameSite;
exports.buildAuthCookieOptions = buildAuthCookieOptions;
exports.getAuthCookieOptions = getAuthCookieOptions;
exports.getAuthClearCookieOptions = getAuthClearCookieOptions;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signAuthToken = signAuthToken;
exports.verifyAuthToken = verifyAuthToken;
exports.createOpaqueToken = createOpaqueToken;
exports.hashOpaqueToken = hashOpaqueToken;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const AUTH_COOKIE_NAME = "mockpaper_auth";
function getAuthCookieName() {
    return AUTH_COOKIE_NAME;
}
function usesHttps(url) {
    try {
        return new URL(url).protocol === "https:";
    }
    catch {
        return false;
    }
}
function shouldUseSecureAuthCookie() {
    if (env_1.env.AUTH_COOKIE_SECURE != null) {
        return env_1.env.AUTH_COOKIE_SECURE;
    }
    return [env_1.env.APP_BASE_URL, env_1.env.FRONTEND_URL].some(usesHttps);
}
function resolveAuthCookieSameSite(secure = shouldUseSecureAuthCookie()) {
    if (env_1.env.AUTH_COOKIE_SAME_SITE !== "auto") {
        return env_1.env.AUTH_COOKIE_SAME_SITE;
    }
    // Separate HTTPS frontend/backend origins require SameSite=None for fetch.
    return secure ? "none" : "lax";
}
function buildAuthCookieOptions(secure = shouldUseSecureAuthCookie()) {
    const sameSite = resolveAuthCookieSameSite(secure);
    return {
        httpOnly: true,
        sameSite,
        secure,
        partitioned: secure && sameSite === "none",
        path: "/",
        maxAge: 1000 * 60 * 60 * 8,
    };
}
function getAuthCookieOptions() {
    return buildAuthCookieOptions();
}
function getAuthClearCookieOptions() {
    const { maxAge: _maxAge, ...options } = getAuthCookieOptions();
    return options;
}
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
async function verifyPassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
function signAuthToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN,
    });
}
function verifyAuthToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
}
function createOpaqueToken(length = 32) {
    return node_crypto_1.default.randomBytes(length).toString("hex");
}
function hashOpaqueToken(token) {
    return node_crypto_1.default.createHash("sha256").update(token).digest("hex");
}
//# sourceMappingURL=auth.js.map