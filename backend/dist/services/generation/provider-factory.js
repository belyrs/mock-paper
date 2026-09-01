"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuestionGenerationProvider = createQuestionGenerationProvider;
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const mock_provider_1 = require("./mock.provider");
const openai_provider_1 = require("./openai.provider");
const resilient_provider_1 = require("./resilient.provider");
function createQuestionGenerationProvider() {
    if (env_1.env.QUESTION_PROVIDER === "mock") {
        logger_1.logger.info("Question generation provider resolved to the deterministic syllabus fallback.");
        return new mock_provider_1.MockQuestionGenerationProvider();
    }
    if (!env_1.env.OPENAI_API_KEY?.trim()) {
        logger_1.logger.warn({
            configuredProvider: env_1.env.QUESTION_PROVIDER,
            fallbackProvider: "mock",
        }, "OPENAI_API_KEY is missing. Falling back to the deterministic syllabus-based generator until a working OpenAI API key is configured.");
        return new mock_provider_1.MockQuestionGenerationProvider();
    }
    logger_1.logger.info({
        provider: "openai",
        fallbackProvider: "mock",
        model: env_1.env.OPENAI_MODEL,
        baseUrl: env_1.env.OPENAI_BASE_URL,
    }, "Question generation provider resolved to OpenAI with deterministic syllabus fallback.");
    return new resilient_provider_1.ResilientQuestionGenerationProvider(new openai_provider_1.OpenAiQuestionGenerationProvider(), new mock_provider_1.MockQuestionGenerationProvider());
}
//# sourceMappingURL=provider-factory.js.map