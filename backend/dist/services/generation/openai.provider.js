"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiQuestionGenerationProvider = void 0;
const app_error_1 = require("../../errors/app-error");
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const prompt_builder_1 = require("./prompt-builder");
const prompt_template_1 = require("./prompt-template");
class OpenAiQuestionGenerationProvider {
    async generate(request) {
        if (!env_1.env.OPENAI_API_KEY) {
            throw new app_error_1.AppError(503, "OPENAI_NOT_CONFIGURED", "OPENAI_API_KEY is required to generate questions.");
        }
        const prompt = (0, prompt_builder_1.buildQuestionPrompt)(request);
        const startedAt = Date.now();
        logger_1.logger.info({
            provider: "openai",
            model: env_1.env.OPENAI_MODEL,
            promptVersion: prompt_template_1.PROMPT_VERSION,
            promptLength: prompt.length,
            subject: request.subject,
            questionCount: request.questionCount,
        }, "Dispatching OpenAI question generation request.");
        const response = await fetch(`${env_1.env.OPENAI_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: env_1.env.OPENAI_MODEL,
                temperature: env_1.env.QUESTION_GENERATION_TEMPERATURE,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: "You are a careful educational content generator. Respond with JSON only and never include markdown fences. The field correctOption must be exactly one uppercase letter A, B, C, or D. The field questionText must contain only the stem and must never inline answer choices.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new app_error_1.AppError(502, "OPENAI_REQUEST_FAILED", "The OpenAI generation request failed.", { status: response.status, body });
        }
        const parsed = (await response.json());
        const content = parsed.choices?.[0]?.message?.content;
        if (!content) {
            throw new app_error_1.AppError(502, "OPENAI_EMPTY_RESPONSE", "The OpenAI response did not contain any generated content.");
        }
        logger_1.logger.info({
            provider: "openai",
            model: env_1.env.OPENAI_MODEL,
            subject: request.subject,
            responseCharacters: content.length,
            latencyMs: Date.now() - startedAt,
        }, "Received OpenAI question generation response.");
        let json;
        try {
            json = JSON.parse(content);
        }
        catch {
            throw new app_error_1.AppError(502, "OPENAI_INVALID_JSON", "The OpenAI response was not valid JSON.", { content });
        }
        return {
            rawPrompt: prompt,
            rawResponse: json,
            provider: "openai",
            model: env_1.env.OPENAI_MODEL,
            questions: json.questions ?? [],
            historicalAnalysisMode: json.historicalAnalysisMode ??
                request.historicalAnalysis.mode,
            historicalAnalysisSummary: json.historicalAnalysisSummary ??
                request.historicalAnalysis.trendSummary,
            metrics: {
                provider: "openai",
                model: env_1.env.OPENAI_MODEL,
                latencyMs: Date.now() - startedAt,
                promptCharacters: prompt.length,
                responseCharacters: content.length,
                usage: {
                    promptTokens: parsed.usage?.prompt_tokens ?? 0,
                    completionTokens: parsed.usage?.completion_tokens ?? 0,
                    totalTokens: parsed.usage?.total_tokens ?? 0,
                    cachedPromptTokens: parsed.usage?.prompt_tokens_details?.cached_tokens ?? 0,
                },
            },
        };
    }
    async embedTexts(texts) {
        if (!env_1.env.OPENAI_API_KEY) {
            throw new app_error_1.AppError(503, "OPENAI_NOT_CONFIGURED", "OPENAI_API_KEY is required to compute semantic similarity.");
        }
        const startedAt = Date.now();
        const response = await fetch(`${env_1.env.OPENAI_BASE_URL}/embeddings`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: env_1.env.OPENAI_EMBEDDING_MODEL,
                input: texts,
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new app_error_1.AppError(502, "OPENAI_EMBEDDING_FAILED", "The OpenAI embedding request failed.", { status: response.status, body });
        }
        const parsed = (await response.json());
        return {
            provider: "openai",
            model: env_1.env.OPENAI_EMBEDDING_MODEL,
            latencyMs: Date.now() - startedAt,
            inputCount: texts.length,
            embeddings: parsed.data?.map((entry) => entry.embedding ?? []) ?? [],
            usage: {
                promptTokens: parsed.usage?.prompt_tokens ?? 0,
                totalTokens: parsed.usage?.total_tokens ?? 0,
            },
        };
    }
}
exports.OpenAiQuestionGenerationProvider = OpenAiQuestionGenerationProvider;
//# sourceMappingURL=openai.provider.js.map