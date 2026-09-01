"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openApiDocument = void 0;
exports.openApiDocument = {
    openapi: "3.1.0",
    info: {
        title: "MockPaper API",
        version: "1.0.0",
        description: "REST API for mock question-paper generation, persistence, and history.",
    },
    servers: [{ url: "/api" }],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "mockpaper_auth",
            },
        },
    },
    paths: {
        "/health": {
            get: {
                summary: "Health check",
                responses: {
                    "200": { description: "Service is healthy" },
                },
            },
        },
        "/auth/register": {
            post: {
                summary: "Register a new user",
                responses: { "201": { description: "Registered successfully" } },
            },
        },
        "/auth/login": {
            post: {
                summary: "Login",
                responses: { "200": { description: "Logged in successfully" } },
            },
        },
        "/auth/me": {
            get: {
                summary: "Get current user",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Current user" } },
            },
        },
        "/auth/logout": {
            post: {
                summary: "Logout",
                security: [{ cookieAuth: [] }],
                responses: { "204": { description: "Logged out" } },
            },
        },
        "/auth/password-reset/request": {
            post: {
                summary: "Start password reset flow",
                responses: { "200": { description: "Reset flow started" } },
            },
        },
        "/auth/password-reset/confirm": {
            post: {
                summary: "Complete password reset flow",
                responses: { "204": { description: "Password updated" } },
            },
        },
        "/papers": {
            get: {
                summary: "List papers for the current user",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Paper list" } },
            },
        },
        "/papers/generate": {
            post: {
                summary: "Generate and persist a new paper",
                security: [{ cookieAuth: [] }],
                responses: { "201": { description: "Paper generated" } },
            },
        },
        "/papers/{paperId}": {
            get: {
                summary: "Get a paper by id",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Paper detail" } },
            },
            patch: {
                summary: "Rename a paper",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Paper updated" } },
            },
            delete: {
                summary: "Soft-delete a paper",
                security: [{ cookieAuth: [] }],
                responses: { "204": { description: "Paper deleted" } },
            },
        },
        "/papers/{paperId}/regenerate": {
            post: {
                summary: "Generate a fresh paper from the stored configuration",
                security: [{ cookieAuth: [] }],
                responses: { "201": { description: "New regenerated paper created" } },
            },
        },
        "/papers/{paperId}/questions/{questionId}": {
            patch: {
                summary: "Edit a single question in a paper",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Paper with updated question" } },
            },
        },
        "/papers/{paperId}/questions/{questionId}/regenerate": {
            post: {
                summary: "Regenerate a single question in a paper",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Paper with regenerated question" } },
            },
        },
        "/historical-papers/status": {
            get: {
                summary: "Get import status for historical papers",
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Historical dataset status" } },
            },
        },
        "/historical-papers/import": {
            post: {
                summary: "Import historical question papers",
                security: [{ cookieAuth: [] }],
                responses: { "201": { description: "Historical papers imported" } },
            },
        },
    },
};
//# sourceMappingURL=openapi.js.map