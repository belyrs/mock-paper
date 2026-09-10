"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateDetectionService = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const normalization_1 = require("../utils/normalization");
const SEMANTIC_PREFILTER_THRESHOLD = 0.45;
const SEMANTIC_LEXICAL_GATE = 0.5;
function emptyMetrics() {
    return {
        exactConflictCount: 0,
        lexicalConflictCount: 0,
        structuralConflictCount: 0,
        semanticConflictCount: 0,
        embeddingCallCount: 0,
        embeddingInputCount: 0,
        embeddingPromptTokens: 0,
        embeddingTotalTokens: 0,
        persistedExistingEmbeddings: 0,
        persistedHistoricalEmbeddings: 0,
        semanticExistingCandidateCount: 0,
        semanticHistoricalCandidateCount: 0,
        semanticTransientCandidateCount: 0,
    };
}
function addEmbeddingMetrics(metrics, result) {
    metrics.embeddingCallCount += 1;
    metrics.embeddingInputCount += result.inputCount;
    metrics.embeddingPromptTokens += result.usage?.promptTokens ?? 0;
    metrics.embeddingTotalTokens += result.usage?.totalTokens ?? 0;
}
class DuplicateDetectionService {
    questionRepository;
    historicalRepository;
    provider;
    constructor(questionRepository, historicalRepository, provider) {
        this.questionRepository = questionRepository;
        this.historicalRepository = historicalRepository;
        this.provider = provider;
    }
    async buildContext(payload) {
        const [existingQuestions, historicalQuestions] = await Promise.all([
            this.questionRepository.findRelevantForDeduplication({
                subject: payload.subject,
                classLevel: payload.classLevel,
                chapterNormalized: (0, normalization_1.normalizeTopicKey)(payload.chapter),
                subTopicNormalized: (0, normalization_1.normalizeTopicKey)(payload.subTopic),
                excludePaperId: payload.excludePaperId,
            }),
            this.historicalRepository.findRelevantQuestions({
                subject: payload.subject,
                chapterNormalized: (0, normalization_1.normalizeTopicKey)(payload.chapter),
                subTopicNormalized: (0, normalization_1.normalizeTopicKey)(payload.subTopic),
            }),
        ]);
        return {
            existingQuestions: existingQuestions.map((question) => ({
                id: question.id,
                text: question.text,
                normalizedHash: question.normalizedHash,
                structuralFingerprint: question.structuralFingerprint,
                semanticEmbedding: question.semanticEmbedding ?? null,
            })),
            historicalQuestions: historicalQuestions.map((question) => ({
                id: question.id,
                text: question.text,
                normalizedHash: question.normalizedHash,
                structuralFingerprint: question.structuralFingerprint,
                semanticEmbedding: question.semanticEmbedding ?? null,
            })),
        };
    }
    findReusableQuestions(payload) {
        return this.questionRepository.findRelevantForDeduplication({
            subject: payload.subject,
            classLevel: payload.classLevel,
            chapterNormalized: (0, normalization_1.normalizeTopicKey)(payload.chapter),
            subTopicNormalized: (0, normalization_1.normalizeTopicKey)(payload.subTopic),
            excludePaperId: payload.excludePaperId,
            limit: payload.limit,
        });
    }
    async assessQuestions(questions, context, options) {
        const conflicts = [];
        const metrics = emptyMetrics();
        const lexicallyAccepted = [];
        const seenCandidateHashes = new Set();
        const acceptedReferences = [
            ...(options?.transientQuestions ?? []).map((question) => ({
                ...question,
            })),
        ];
        for (const question of questions) {
            if (seenCandidateHashes.has(question.normalizedHash)) {
                metrics.exactConflictCount += 1;
                conflicts.push({
                    question,
                    source: "generated_batch",
                    message: "Generated batch contains duplicate normalized question text.",
                });
                continue;
            }
            seenCandidateHashes.add(question.normalizedHash);
            const conflict = this.findDeterministicConflict(question, context, acceptedReferences, options?.excludeQuestionId);
            if (conflict) {
                this.recordConflictMetrics(metrics, conflict.classification);
                conflicts.push(conflict);
                continue;
            }
            lexicallyAccepted.push(question);
            acceptedReferences.push(this.toReference(question, `accepted-${acceptedReferences.length + 1}`));
        }
        if (!env_1.env.SEMANTIC_DEDUP_ENABLED ||
            !this.provider.embedTexts ||
            lexicallyAccepted.length === 0) {
            return {
                acceptedQuestions: lexicallyAccepted,
                conflicts,
                metrics,
            };
        }
        const semanticSeedReferences = [
            ...(options?.transientQuestions ?? []).map((question) => ({
                ...question,
            })),
        ];
        const selectedExistingIds = new Set();
        const selectedHistoricalIds = new Set();
        const selectedTransientIds = new Set();
        let pairwiseSemanticCandidateExists = false;
        for (let index = 0; index < lexicallyAccepted.length; index += 1) {
            const question = lexicallyAccepted[index];
            for (const existingQuestion of context.existingQuestions) {
                if (options?.excludeQuestionId &&
                    existingQuestion.id === options.excludeQuestionId) {
                    continue;
                }
                if (this.shouldConsiderForSemanticCheck(question, existingQuestion)) {
                    selectedExistingIds.add(existingQuestion.id);
                }
            }
            for (const historicalQuestion of context.historicalQuestions) {
                if (this.shouldConsiderForSemanticCheck(question, historicalQuestion)) {
                    selectedHistoricalIds.add(historicalQuestion.id);
                }
            }
            for (const transientQuestion of semanticSeedReferences) {
                if (this.shouldConsiderForSemanticCheck(question, transientQuestion)) {
                    selectedTransientIds.add(transientQuestion.id);
                }
            }
            for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
                if (this.shouldConsiderForSemanticCheck(question, lexicallyAccepted[priorIndex])) {
                    pairwiseSemanticCandidateExists = true;
                    break;
                }
            }
        }
        metrics.semanticExistingCandidateCount = selectedExistingIds.size;
        metrics.semanticHistoricalCandidateCount = selectedHistoricalIds.size;
        metrics.semanticTransientCandidateCount = selectedTransientIds.size;
        if (selectedExistingIds.size === 0 &&
            selectedHistoricalIds.size === 0 &&
            selectedTransientIds.size === 0 &&
            !pairwiseSemanticCandidateExists) {
            return {
                acceptedQuestions: lexicallyAccepted,
                conflicts,
                metrics,
            };
        }
        const existingById = new Map(context.existingQuestions.map((question) => [
            question.id,
            { ...question },
        ]));
        const historicalById = new Map(context.historicalQuestions.map((question) => [
            question.id,
            { ...question },
        ]));
        const transientById = new Map(semanticSeedReferences.map((question) => [question.id, { ...question }]));
        try {
            const generatedEmbeddingResult = await this.provider.embedTexts(lexicallyAccepted.map((question) => question.text));
            addEmbeddingMetrics(metrics, generatedEmbeddingResult);
            lexicallyAccepted.forEach((question, index) => {
                question.semanticEmbedding =
                    generatedEmbeddingResult.embeddings[index] ?? [];
            });
            const missingExisting = [...selectedExistingIds]
                .map((id) => existingById.get(id))
                .filter((question) => Boolean(question && !question.semanticEmbedding));
            const missingHistorical = [...selectedHistoricalIds]
                .map((id) => historicalById.get(id))
                .filter((question) => Boolean(question && !question.semanticEmbedding));
            const missingTransient = [...selectedTransientIds]
                .map((id) => transientById.get(id))
                .filter((question) => Boolean(question && !question.semanticEmbedding));
            const [existingEmbeddingResult, historicalEmbeddingResult, transientEmbeddingResult,] = await Promise.all([
                missingExisting.length > 0
                    ? this.provider.embedTexts(missingExisting.map((question) => question.text))
                    : Promise.resolve(null),
                missingHistorical.length > 0
                    ? this.provider.embedTexts(missingHistorical.map((question) => question.text))
                    : Promise.resolve(null),
                missingTransient.length > 0
                    ? this.provider.embedTexts(missingTransient.map((question) => question.text))
                    : Promise.resolve(null),
            ]);
            if (existingEmbeddingResult) {
                addEmbeddingMetrics(metrics, existingEmbeddingResult);
                missingExisting.forEach((question, index) => {
                    question.semanticEmbedding =
                        existingEmbeddingResult.embeddings[index] ?? [];
                });
                await this.questionRepository.updateSemanticArtifacts(missingExisting.map((question) => ({
                    id: question.id,
                    semanticEmbedding: question.semanticEmbedding,
                })));
                metrics.persistedExistingEmbeddings += missingExisting.length;
            }
            if (historicalEmbeddingResult) {
                addEmbeddingMetrics(metrics, historicalEmbeddingResult);
                missingHistorical.forEach((question, index) => {
                    question.semanticEmbedding =
                        historicalEmbeddingResult.embeddings[index] ?? [];
                });
                await this.historicalRepository.updateSemanticArtifacts(missingHistorical.map((question) => ({
                    id: question.id,
                    semanticEmbedding: question.semanticEmbedding,
                })));
                metrics.persistedHistoricalEmbeddings += missingHistorical.length;
            }
            if (transientEmbeddingResult) {
                addEmbeddingMetrics(metrics, transientEmbeddingResult);
                missingTransient.forEach((question, index) => {
                    question.semanticEmbedding =
                        transientEmbeddingResult.embeddings[index] ?? [];
                });
            }
        }
        catch (error) {
            logger_1.logger.warn({ err: error }, "Semantic duplicate detection failed; falling back to deterministic checks.");
            return {
                acceptedQuestions: lexicallyAccepted,
                conflicts,
                metrics,
            };
        }
        const resolvedTransientReferences = [...semanticSeedReferences];
        const semanticallyAccepted = [];
        for (const question of lexicallyAccepted) {
            const semanticConflict = this.findSemanticConflict(question, context, existingById, historicalById, resolvedTransientReferences, options?.excludeQuestionId);
            if (semanticConflict) {
                metrics.semanticConflictCount += 1;
                conflicts.push(semanticConflict);
                continue;
            }
            semanticallyAccepted.push(question);
            resolvedTransientReferences.push(this.toReference(question, `semantic-accepted-${resolvedTransientReferences.length + 1}`));
        }
        return {
            acceptedQuestions: semanticallyAccepted,
            conflicts,
            metrics,
        };
    }
    async assertNoConflicts(questions, context, excludeQuestionId, transientQuestions) {
        const assessment = await this.assessQuestions(questions, context, {
            excludeQuestionId,
            transientQuestions,
        });
        if (assessment.conflicts.length > 0) {
            throw new Error(assessment.conflicts[0]?.message ??
                "Generated question conflicts with existing data.");
        }
    }
    recordConflictMetrics(metrics, classification) {
        if (classification === "exact") {
            metrics.exactConflictCount += 1;
            return;
        }
        if (classification === "structural") {
            metrics.structuralConflictCount += 1;
            return;
        }
        metrics.lexicalConflictCount += 1;
    }
    findDeterministicConflict(question, context, acceptedReferences, excludeQuestionId) {
        for (const acceptedQuestion of acceptedReferences) {
            const exactConflict = this.matchExact(question, acceptedQuestion, "accepted_attempt");
            if (exactConflict)
                return exactConflict;
        }
        for (const existingQuestion of context.existingQuestions) {
            if (excludeQuestionId && existingQuestion.id === excludeQuestionId)
                continue;
            const exactConflict = this.matchExact(question, existingQuestion, "existing_question_bank");
            if (exactConflict)
                return exactConflict;
        }
        for (const historicalQuestion of context.historicalQuestions) {
            const exactConflict = this.matchExact(question, historicalQuestion, "historical_paper");
            if (exactConflict)
                return exactConflict;
        }
        return null;
    }
    matchExact(question, reference, source) {
        if (reference.normalizedHash !== question.normalizedHash) {
            return null;
        }
        return {
            question,
            source,
            classification: "exact",
            message: source === "historical_paper"
                ? "Generated question matches a historical paper question exactly."
                : "Generated question matches an existing question exactly.",
        };
    }
    findSemanticConflict(question, context, existingById, historicalById, transientReferences, excludeQuestionId) {
        for (const transientQuestion of transientReferences) {
            if (!this.shouldConsiderForSemanticCheck(question, transientQuestion)) {
                continue;
            }
            const embedding = transientQuestion.semanticEmbedding ?? [];
            if (this.isSemanticDuplicate(question.text, transientQuestion.text, question.semanticEmbedding ?? [], embedding)) {
                return {
                    question,
                    source: "accepted_attempt_semantic",
                    message: "Generated question is semantically too similar to another accepted question from this generation run.",
                };
            }
        }
        for (const [id, existingQuestion] of existingById.entries()) {
            if (excludeQuestionId && id === excludeQuestionId)
                continue;
            if (!this.shouldConsiderForSemanticCheck(question, existingQuestion)) {
                continue;
            }
            const embedding = existingQuestion.semanticEmbedding ?? [];
            if (this.isSemanticDuplicate(question.text, existingQuestion.text, question.semanticEmbedding ?? [], embedding)) {
                return {
                    question,
                    source: "existing_question_bank_semantic",
                    message: "Generated question is semantically too similar to an existing question.",
                };
            }
        }
        for (const historicalQuestion of historicalById.values()) {
            if (!this.shouldConsiderForSemanticCheck(question, historicalQuestion)) {
                continue;
            }
            const embedding = historicalQuestion.semanticEmbedding ?? [];
            if (this.isSemanticDuplicate(question.text, historicalQuestion.text, question.semanticEmbedding ?? [], embedding)) {
                return {
                    question,
                    source: "historical_paper_semantic",
                    message: "Generated question is semantically too similar to a historical paper question.",
                };
            }
        }
        return null;
    }
    toReference(question, id) {
        return {
            id,
            text: question.text,
            normalizedHash: question.normalizedHash,
            structuralFingerprint: question.structuralFingerprint,
            semanticEmbedding: question.semanticEmbedding,
        };
    }
    shouldConsiderForSemanticCheck(question, reference) {
        if (question.structuralFingerprint === reference.structuralFingerprint) {
            return true;
        }
        return ((0, normalization_1.structuralSimilarity)(question.text, reference.text) >=
            SEMANTIC_PREFILTER_THRESHOLD ||
            (0, normalization_1.jaccardSimilarity)(question.text, reference.text) >=
                SEMANTIC_PREFILTER_THRESHOLD);
    }
    isSemanticDuplicate(leftText, rightText, leftEmbedding, rightEmbedding) {
        if (leftEmbedding.length === 0 || rightEmbedding.length === 0) {
            return false;
        }
        const lexicalSimilarity = (0, normalization_1.jaccardSimilarity)(leftText, rightText);
        const structuralScore = (0, normalization_1.structuralSimilarity)(leftText, rightText);
        if (lexicalSimilarity < SEMANTIC_LEXICAL_GATE &&
            structuralScore < SEMANTIC_LEXICAL_GATE) {
            return false;
        }
        return ((0, normalization_1.cosineSimilarity)(leftEmbedding, rightEmbedding) >=
            env_1.env.SEMANTIC_SIMILARITY_THRESHOLD);
    }
}
exports.DuplicateDetectionService = DuplicateDetectionService;
//# sourceMappingURL=duplicate-detection.service.js.map