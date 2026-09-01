"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilientQuestionGenerationProvider = void 0;
const logger_1 = require("../../config/logger");
const app_error_1 = require("../../errors/app-error");
function isFallbackEligible(error) {
    if (!(error instanceof app_error_1.AppError)) {
        return false;
    }
    if (error.code === "OPENAI_NOT_CONFIGURED") {
        return true;
    }
    if (!error.code.startsWith("OPENAI_")) {
        return false;
    }
    const status = Number(error.details?.status ?? 0);
    return [401, 402, 408, 409, 422, 429, 500, 502, 503, 504].includes(status) || status === 0;
}
class ResilientQuestionGenerationProvider {
    primaryProvider;
    fallbackProvider;
    constructor(primaryProvider, fallbackProvider) {
        this.primaryProvider = primaryProvider;
        this.fallbackProvider = fallbackProvider;
    }
    async generate(request) {
        try {
            return await this.primaryProvider.generate(request);
        }
        catch (error) {
            if (!isFallbackEligible(error)) {
                throw error;
            }
            logger_1.logger.warn({
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
                err: error,
                fallbackProvider: this.fallbackProvider.constructor.name,
            }, "Primary generation provider failed. Falling back to the deterministic syllabus-based generator.");
            const fallbackResult = await this.fallbackProvider.generate(request);
            return {
                ...fallbackResult,
                rawResponse: {
                    ...fallbackResult.rawResponse,
                    fallback: {
                        attemptedProvider: "openai",
                        fallbackProvider: fallbackResult.provider,
                        reason: error instanceof Error ? error.message : "Unknown provider failure",
                        errorCode: error instanceof app_error_1.AppError ? error.code : "UNKNOWN_PROVIDER_ERROR",
                        errorDetails: error instanceof app_error_1.AppError ? error.details ?? null : null,
                    },
                },
            };
        }
    }
    async embedTexts(texts) {
        if (this.primaryProvider.embedTexts) {
            try {
                return await this.primaryProvider.embedTexts(texts);
            }
            catch (error) {
                logger_1.logger.warn({
                    textCount: texts.length,
                    err: error,
                    fallbackProvider: this.fallbackProvider.constructor.name,
                }, "Primary embedding provider failed. Falling back to the secondary embedding provider.");
            }
        }
        if (this.fallbackProvider.embedTexts) {
            return this.fallbackProvider.embedTexts(texts);
        }
        throw new Error("No embedding provider is available for semantic duplicate detection.");
    }
}
exports.ResilientQuestionGenerationProvider = ResilientQuestionGenerationProvider;
//# sourceMappingURL=resilient.provider.js.map