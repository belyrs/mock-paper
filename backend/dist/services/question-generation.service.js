"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionGenerationService = void 0;
const app_error_1 = require("../errors/app-error");
const logger_1 = require("../config/logger");
const output_validator_1 = require("./generation/output-validator");
const prompt_template_1 = require("./generation/prompt-template");
const env_1 = require("../config/env");
const difficulty_1 = require("../utils/difficulty");
const normalization_1 = require("../utils/normalization");
const plan_builder_1 = require("./generation/plan-builder");
class QuestionGenerationService {
    provider;
    duplicateDetectionService;
    historicalAnalysisService;
    syllabusGroundingService;
    constructor(provider, duplicateDetectionService, historicalAnalysisService, syllabusGroundingService) {
        this.provider = provider;
        this.duplicateDetectionService = duplicateDetectionService;
        this.historicalAnalysisService = historicalAnalysisService;
        this.syllabusGroundingService = syllabusGroundingService;
    }
    async generateForSubject(input) {
        const startedAt = Date.now();
        logger_1.logger.info({
            subject: input.subjectConfiguration.subject,
            classLevel: input.classLevel,
            chapter: input.subjectConfiguration.chapter,
            subTopic: input.subjectConfiguration.subTopic,
            questionCount: input.subjectConfiguration.numberOfQuestions,
            targetExams: input.targetExams,
            provider: this.provider.constructor.name,
        }, "Question generation started for subject configuration.");
        const historicalAnalysisSummary = await this.historicalAnalysisService.analyseSubjectConfiguration(input.subjectConfiguration, input.targetExams);
        logger_1.logger.info({
            subject: input.subjectConfiguration.subject,
            mode: historicalAnalysisSummary.mode,
            totalRelevantQuestions: historicalAnalysisSummary.totalRelevantQuestions,
            yearsCovered: historicalAnalysisSummary.yearsCovered,
        }, "Historical analysis prepared for generation.");
        const syllabusContext = this.syllabusGroundingService.resolve({
            subject: input.subjectConfiguration.subject,
            chapter: input.subjectConfiguration.chapter,
            subTopic: input.subjectConfiguration.subTopic,
        });
        logger_1.logger.info({
            subject: input.subjectConfiguration.subject,
            chapter: input.subjectConfiguration.chapter,
            subTopic: input.subjectConfiguration.subTopic,
            syllabusEntryKey: syllabusContext.entryKey,
            canonicalMatch: syllabusContext.canonicalMatch,
            matchScore: syllabusContext.matchScore,
            coreConceptCount: syllabusContext.coreConcepts.length,
        }, "Syllabus grounding resolved for generation.");
        const duplicateContext = await this.duplicateDetectionService.buildContext({
            subject: input.subjectConfiguration.subject,
            classLevel: input.classLevel,
            chapter: input.subjectConfiguration.chapter,
            subTopic: input.subjectConfiguration.subTopic,
            excludePaperId: input.excludePaperId,
        });
        logger_1.logger.info({
            subject: input.subjectConfiguration.subject,
            existingQuestionCount: duplicateContext.existingQuestions.length,
            historicalQuestionCount: duplicateContext.historicalQuestions.length,
        }, "Duplicate detection context prepared.");
        const request = {
            subject: input.subjectConfiguration.subject,
            classLevel: input.classLevel,
            chapter: input.subjectConfiguration.chapter,
            subTopic: input.subjectConfiguration.subTopic,
            targetExams: input.targetExams,
            questionCount: input.subjectConfiguration.numberOfQuestions,
            difficultyMix: input.subjectConfiguration.mix,
            historicalAnalysis: historicalAnalysisSummary,
            previousQuestions: [],
            syllabusContext,
            generationPlan: [],
        };
        const targetDifficultyCounts = (0, difficulty_1.mixToCounts)(input.subjectConfiguration.mix, input.subjectConfiguration.numberOfQuestions);
        const acceptedQuestions = [];
        const rejectedQuestionTexts = [];
        const rejectionReasons = [];
        const attemptSummaries = [];
        const aggregateMetrics = {
            chatCallCount: 0,
            embeddingCallCount: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cachedPromptTokens: 0,
            promptCharacters: 0,
            responseCharacters: 0,
            exactConflictCount: 0,
            lexicalConflictCount: 0,
            structuralConflictCount: 0,
            semanticConflictCount: 0,
            embeddingPromptTokens: 0,
            embeddingTotalTokens: 0,
        };
        const buildPreviousQuestions = () => {
            const compact = (text) => text.replace(/\s+/g, " ").trim().slice(0, 120);
            const prioritized = [
                ...acceptedQuestions.map((question) => question.text),
                ...rejectedQuestionTexts.slice(-4),
                ...input.previousQuestionTexts.slice(-4),
                ...duplicateContext.existingQuestions.slice(0, 8).map((question) => question.text),
                ...duplicateContext.historicalQuestions.slice(0, 4).map((question) => question.text),
            ];
            const seen = new Set();
            const compacted = [];
            for (const text of prioritized) {
                const normalized = (0, normalization_1.normalizeText)(text);
                if (!normalized || seen.has(normalized)) {
                    continue;
                }
                seen.add(normalized);
                compacted.push(compact(text));
                if (compacted.length >= 16) {
                    break;
                }
            }
            return compacted;
        };
        let lastError = null;
        for (let attempt = 1; attempt <= env_1.env.QUESTION_GENERATION_MAX_ATTEMPTS; attempt += 1) {
            try {
                const acceptedCounts = (0, difficulty_1.countByDifficulty)(acceptedQuestions);
                const remainingDifficultyCounts = (0, difficulty_1.subtractDifficultyCounts)(targetDifficultyCounts, acceptedCounts);
                const remainingQuestionCount = (0, difficulty_1.totalDifficultyCount)(remainingDifficultyCounts);
                if (remainingQuestionCount === 0) {
                    break;
                }
                const attemptRequest = {
                    ...request,
                    questionCount: remainingQuestionCount,
                    difficultyCounts: remainingDifficultyCounts,
                    previousQuestions: buildPreviousQuestions(),
                    generationPlan: (0, plan_builder_1.buildGenerationPlan)({
                        ...request,
                        questionCount: remainingQuestionCount,
                        difficultyCounts: remainingDifficultyCounts,
                    }),
                    retryContext: attempt > 1
                        ? {
                            attempt,
                            acceptedQuestionTexts: acceptedQuestions.map((question) => question.text),
                            rejectedQuestionTexts: rejectedQuestionTexts.slice(-10),
                            rejectionReasons: [...new Set(rejectionReasons)].slice(-6),
                        }
                        : undefined,
                };
                logger_1.logger.info({
                    subject: request.subject,
                    attempt,
                    maxAttempts: env_1.env.QUESTION_GENERATION_MAX_ATTEMPTS,
                    questionCount: attemptRequest.questionCount,
                    acceptedQuestionCount: acceptedQuestions.length,
                    remainingDifficultyCounts,
                    promptExclusionCount: attemptRequest.previousQuestions.length,
                    generationPlanSlots: attemptRequest.generationPlan.length,
                }, "Question generation attempt started.");
                const providerResult = await this.provider.generate(attemptRequest);
                logger_1.logger.info({
                    subject: request.subject,
                    attempt,
                    provider: providerResult.provider,
                    model: providerResult.model,
                    generatedQuestionCount: providerResult.questions.length,
                    promptTokens: providerResult.metrics?.usage?.promptTokens ?? 0,
                    completionTokens: providerResult.metrics?.usage?.completionTokens ?? 0,
                    cachedPromptTokens: providerResult.metrics?.usage?.cachedPromptTokens ?? 0,
                    providerLatencyMs: providerResult.metrics?.latencyMs ?? null,
                }, "Question generation provider returned a response.");
                aggregateMetrics.chatCallCount += 1;
                aggregateMetrics.promptTokens += providerResult.metrics?.usage?.promptTokens ?? 0;
                aggregateMetrics.completionTokens += providerResult.metrics?.usage?.completionTokens ?? 0;
                aggregateMetrics.totalTokens += providerResult.metrics?.usage?.totalTokens ?? 0;
                aggregateMetrics.cachedPromptTokens += providerResult.metrics?.usage?.cachedPromptTokens ?? 0;
                aggregateMetrics.promptCharacters += providerResult.metrics?.promptCharacters ?? 0;
                aggregateMetrics.responseCharacters += providerResult.metrics?.responseCharacters ?? 0;
                const validatedQuestions = (0, output_validator_1.validateProviderOutput)(attemptRequest, providerResult);
                logger_1.logger.info({
                    subject: request.subject,
                    attempt,
                    validatedQuestionCount: validatedQuestions.length,
                }, "Generated questions passed schema validation.");
                const duplicateAssessment = await this.duplicateDetectionService.assessQuestions(validatedQuestions, duplicateContext, {
                    excludeQuestionId: input.excludeQuestionId,
                    transientQuestions: acceptedQuestions.map((question, index) => ({
                        id: `accepted-${index + 1}`,
                        text: question.text,
                        normalizedHash: question.normalizedHash,
                        structuralFingerprint: question.structuralFingerprint,
                        semanticEmbedding: question.semanticEmbedding,
                    })),
                });
                aggregateMetrics.embeddingCallCount += duplicateAssessment.metrics.embeddingCallCount;
                aggregateMetrics.embeddingPromptTokens += duplicateAssessment.metrics.embeddingPromptTokens;
                aggregateMetrics.embeddingTotalTokens += duplicateAssessment.metrics.embeddingTotalTokens;
                aggregateMetrics.exactConflictCount += duplicateAssessment.metrics.exactConflictCount;
                aggregateMetrics.lexicalConflictCount += duplicateAssessment.metrics.lexicalConflictCount;
                aggregateMetrics.structuralConflictCount +=
                    duplicateAssessment.metrics.structuralConflictCount;
                aggregateMetrics.semanticConflictCount += duplicateAssessment.metrics.semanticConflictCount;
                acceptedQuestions.push(...duplicateAssessment.acceptedQuestions);
                if (duplicateAssessment.conflicts.length > 0) {
                    rejectedQuestionTexts.push(...duplicateAssessment.conflicts.map((conflict) => conflict.question.text));
                    rejectionReasons.push(...duplicateAssessment.conflicts.map((conflict) => conflict.message));
                    logger_1.logger.warn({
                        subject: request.subject,
                        attempt,
                        acceptedThisAttempt: duplicateAssessment.acceptedQuestions.length,
                        acceptedTotal: acceptedQuestions.length,
                        remainingQuestionCount: input.subjectConfiguration.numberOfQuestions - acceptedQuestions.length,
                        conflictCount: duplicateAssessment.conflicts.length,
                        conflictMessages: [
                            ...new Set(duplicateAssessment.conflicts.map((conflict) => conflict.message)),
                        ].slice(0, 4),
                    }, "Generated batch contained duplicate conflicts. Keeping the unique questions and retrying only the remaining slots.");
                }
                attemptSummaries.push({
                    attempt,
                    requestedQuestionCount: attemptRequest.questionCount,
                    acceptedQuestionCount: duplicateAssessment.acceptedQuestions.length,
                    conflictCount: duplicateAssessment.conflicts.length,
                    provider: providerResult.provider,
                    model: providerResult.model,
                    generationPlan: attemptRequest.generationPlan,
                    providerMetrics: providerResult.metrics ?? null,
                    duplicateMetrics: duplicateAssessment.metrics,
                });
                if (acceptedQuestions.length !== input.subjectConfiguration.numberOfQuestions) {
                    if (attempt < env_1.env.QUESTION_GENERATION_MAX_ATTEMPTS) {
                        continue;
                    }
                    lastError = new app_error_1.AppError(409, "QUESTION_GENERATION_UNIQUE_EXHAUSTED", "The generator could not produce enough unique non-repeating questions for this syllabus slice within the retry limit.", {
                        requestedQuestionCount: input.subjectConfiguration.numberOfQuestions,
                        acceptedQuestionCount: acceptedQuestions.length,
                        rejectionReasons: [...new Set(rejectionReasons)],
                    });
                    continue;
                }
                logger_1.logger.info({
                    subject: request.subject,
                    attempt,
                    validatedQuestionCount: acceptedQuestions.length,
                    provider: providerResult.provider,
                    model: providerResult.model,
                    promptVersion: prompt_template_1.PROMPT_VERSION,
                }, "Question generation completed successfully.");
                return {
                    questions: acceptedQuestions,
                    generationRun: {
                        status: "completed",
                        provider: providerResult.provider,
                        model: providerResult.model,
                        promptVersion: prompt_template_1.PROMPT_VERSION,
                        requestPayload: {
                            ...request,
                            targetDifficultyCounts,
                            previousQuestions: buildPreviousQuestions(),
                        },
                        responsePayload: {
                            attempts: attemptSummaries,
                            latestProviderResponse: providerResult.rawResponse,
                        },
                        validationReport: {
                            attempt,
                            validatedQuestionCount: acceptedQuestions.length,
                            attemptSummaries,
                            metrics: {
                                ...aggregateMetrics,
                                durationMs: Date.now() - startedAt,
                            },
                        },
                        failureReason: null,
                    },
                    historicalAnalysisSummary,
                };
            }
            catch (error) {
                lastError = error;
                logger_1.logger.warn({
                    subject: request.subject,
                    attempt,
                    maxAttempts: env_1.env.QUESTION_GENERATION_MAX_ATTEMPTS,
                    err: error,
                }, "Question generation attempt failed.");
            }
        }
        if (lastError instanceof app_error_1.AppError) {
            throw lastError;
        }
        throw new app_error_1.AppError(502, "QUESTION_GENERATION_FAILED", "Question generation failed after all retry attempts.", {
            reason: lastError instanceof Error ? lastError.message : "Unknown generation error",
        });
    }
}
exports.QuestionGenerationService = QuestionGenerationService;
//# sourceMappingURL=question-generation.service.js.map