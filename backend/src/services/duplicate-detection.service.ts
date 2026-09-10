import { env } from "../config/env";
import { logger } from "../config/logger";
import type { ClassLevel } from "../constants/domain";
import { HistoricalRepository } from "../repositories/historical.repository";
import { QuestionRepository } from "../repositories/question.repository";
import {
  cosineSimilarity,
  jaccardSimilarity,
  normalizeTopicKey,
  structuralSimilarity,
} from "../utils/normalization";
import type {
  EmbeddingCallResult,
  QuestionGenerationProvider,
  ValidatedQuestionPayload,
} from "./generation/types";

const SEMANTIC_PREFILTER_THRESHOLD = 0.45;
const SEMANTIC_LEXICAL_GATE = 0.5;

interface DuplicateReference {
  id: string;
  text: string;
  normalizedHash: string;
  structuralFingerprint: string;
  semanticEmbedding: number[] | null;
}

interface DuplicateContext {
  existingQuestions: DuplicateReference[];
  historicalQuestions: DuplicateReference[];
}

interface TransientQuestionReference extends DuplicateReference {}

export interface DuplicateConflict {
  question: ValidatedQuestionPayload;
  message: string;
  source:
    | "generated_batch"
    | "accepted_attempt"
    | "accepted_attempt_structural"
    | "existing_question_bank"
    | "existing_question_bank_structural"
    | "historical_paper"
    | "historical_paper_structural"
    | "existing_question_bank_semantic"
    | "historical_paper_semantic"
    | "accepted_attempt_semantic";
}

export interface DuplicateAssessmentMetrics {
  exactConflictCount: number;
  lexicalConflictCount: number;
  structuralConflictCount: number;
  semanticConflictCount: number;
  embeddingCallCount: number;
  embeddingInputCount: number;
  embeddingPromptTokens: number;
  embeddingTotalTokens: number;
  persistedExistingEmbeddings: number;
  persistedHistoricalEmbeddings: number;
  semanticExistingCandidateCount: number;
  semanticHistoricalCandidateCount: number;
  semanticTransientCandidateCount: number;
}

export interface DuplicateAssessmentResult {
  acceptedQuestions: ValidatedQuestionPayload[];
  conflicts: DuplicateConflict[];
  metrics: DuplicateAssessmentMetrics;
}

interface DeterministicConflict extends DuplicateConflict {
  classification: "exact" | "lexical" | "structural";
}

function emptyMetrics(): DuplicateAssessmentMetrics {
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

function addEmbeddingMetrics(
  metrics: DuplicateAssessmentMetrics,
  result: EmbeddingCallResult,
) {
  metrics.embeddingCallCount += 1;
  metrics.embeddingInputCount += result.inputCount;
  metrics.embeddingPromptTokens += result.usage?.promptTokens ?? 0;
  metrics.embeddingTotalTokens += result.usage?.totalTokens ?? 0;
}

export class DuplicateDetectionService {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly historicalRepository: HistoricalRepository,
    private readonly provider: QuestionGenerationProvider,
  ) {}

  async buildContext(payload: {
    subject: string;
    classLevel: ClassLevel;
    chapter: string;
    subTopic: string;
    excludePaperId?: string;
  }): Promise<DuplicateContext> {
    const [existingQuestions, historicalQuestions] = await Promise.all([
      this.questionRepository.findRelevantForDeduplication({
        subject: payload.subject,
        classLevel: payload.classLevel,
        chapterNormalized: normalizeTopicKey(payload.chapter),
        subTopicNormalized: normalizeTopicKey(payload.subTopic),
        excludePaperId: payload.excludePaperId,
      }),
      this.historicalRepository.findRelevantQuestions({
        subject: payload.subject,
        chapterNormalized: normalizeTopicKey(payload.chapter),
        subTopicNormalized: normalizeTopicKey(payload.subTopic),
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

  findReusableQuestions(payload: {
    subject: string;
    classLevel: ClassLevel;
    chapter: string;
    subTopic: string;
    excludePaperId?: string;
    limit?: number;
  }) {
    return this.questionRepository.findRelevantForDeduplication({
      subject: payload.subject,
      classLevel: payload.classLevel,
      chapterNormalized: normalizeTopicKey(payload.chapter),
      subTopicNormalized: normalizeTopicKey(payload.subTopic),
      excludePaperId: payload.excludePaperId,
      limit: payload.limit,
    });
  }

  async assessQuestions(
    questions: ValidatedQuestionPayload[],
    context: DuplicateContext,
    options?: {
      excludeQuestionId?: string;
      transientQuestions?: TransientQuestionReference[];
    },
  ): Promise<DuplicateAssessmentResult> {
    const conflicts: DuplicateConflict[] = [];
    const metrics = emptyMetrics();
    const lexicallyAccepted: ValidatedQuestionPayload[] = [];
    const seenCandidateHashes = new Set<string>();
    const acceptedReferences: TransientQuestionReference[] = [
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
          message:
            "Generated batch contains duplicate normalized question text.",
        });
        continue;
      }

      seenCandidateHashes.add(question.normalizedHash);

      const conflict = this.findDeterministicConflict(
        question,
        context,
        acceptedReferences,
        options?.excludeQuestionId,
      );

      if (conflict) {
        this.recordConflictMetrics(metrics, conflict.classification);
        conflicts.push(conflict);
        continue;
      }

      lexicallyAccepted.push(question);
      acceptedReferences.push(
        this.toReference(question, `accepted-${acceptedReferences.length + 1}`),
      );
    }

    if (
      !env.SEMANTIC_DEDUP_ENABLED ||
      !this.provider.embedTexts ||
      lexicallyAccepted.length === 0
    ) {
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

    const selectedExistingIds = new Set<string>();
    const selectedHistoricalIds = new Set<string>();
    const selectedTransientIds = new Set<string>();
    let pairwiseSemanticCandidateExists = false;

    for (let index = 0; index < lexicallyAccepted.length; index += 1) {
      const question = lexicallyAccepted[index]!;

      for (const existingQuestion of context.existingQuestions) {
        if (
          options?.excludeQuestionId &&
          existingQuestion.id === options.excludeQuestionId
        ) {
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
        if (
          this.shouldConsiderForSemanticCheck(
            question,
            lexicallyAccepted[priorIndex]!,
          )
        ) {
          pairwiseSemanticCandidateExists = true;
          break;
        }
      }
    }

    metrics.semanticExistingCandidateCount = selectedExistingIds.size;
    metrics.semanticHistoricalCandidateCount = selectedHistoricalIds.size;
    metrics.semanticTransientCandidateCount = selectedTransientIds.size;

    if (
      selectedExistingIds.size === 0 &&
      selectedHistoricalIds.size === 0 &&
      selectedTransientIds.size === 0 &&
      !pairwiseSemanticCandidateExists
    ) {
      return {
        acceptedQuestions: lexicallyAccepted,
        conflicts,
        metrics,
      };
    }

    const existingById = new Map(
      context.existingQuestions.map((question) => [
        question.id,
        { ...question },
      ]),
    );
    const historicalById = new Map(
      context.historicalQuestions.map((question) => [
        question.id,
        { ...question },
      ]),
    );
    const transientById = new Map(
      semanticSeedReferences.map((question) => [question.id, { ...question }]),
    );

    try {
      const generatedEmbeddingResult = await this.provider.embedTexts(
        lexicallyAccepted.map((question) => question.text),
      );
      addEmbeddingMetrics(metrics, generatedEmbeddingResult);
      lexicallyAccepted.forEach((question, index) => {
        question.semanticEmbedding =
          generatedEmbeddingResult.embeddings[index] ?? [];
      });

      const missingExisting = [...selectedExistingIds]
        .map((id) => existingById.get(id))
        .filter((question): question is DuplicateReference =>
          Boolean(question && !question.semanticEmbedding),
        );
      const missingHistorical = [...selectedHistoricalIds]
        .map((id) => historicalById.get(id))
        .filter((question): question is DuplicateReference =>
          Boolean(question && !question.semanticEmbedding),
        );
      const missingTransient = [...selectedTransientIds]
        .map((id) => transientById.get(id))
        .filter((question): question is DuplicateReference =>
          Boolean(question && !question.semanticEmbedding),
        );

      const [
        existingEmbeddingResult,
        historicalEmbeddingResult,
        transientEmbeddingResult,
      ] = await Promise.all([
        missingExisting.length > 0
          ? this.provider.embedTexts(
              missingExisting.map((question) => question.text),
            )
          : Promise.resolve(null),
        missingHistorical.length > 0
          ? this.provider.embedTexts(
              missingHistorical.map((question) => question.text),
            )
          : Promise.resolve(null),
        missingTransient.length > 0
          ? this.provider.embedTexts(
              missingTransient.map((question) => question.text),
            )
          : Promise.resolve(null),
      ]);

      if (existingEmbeddingResult) {
        addEmbeddingMetrics(metrics, existingEmbeddingResult);
        missingExisting.forEach((question, index) => {
          question.semanticEmbedding =
            existingEmbeddingResult.embeddings[index] ?? [];
        });
        await this.questionRepository.updateSemanticArtifacts(
          missingExisting.map((question) => ({
            id: question.id,
            semanticEmbedding: question.semanticEmbedding,
          })),
        );
        metrics.persistedExistingEmbeddings += missingExisting.length;
      }

      if (historicalEmbeddingResult) {
        addEmbeddingMetrics(metrics, historicalEmbeddingResult);
        missingHistorical.forEach((question, index) => {
          question.semanticEmbedding =
            historicalEmbeddingResult.embeddings[index] ?? [];
        });
        await this.historicalRepository.updateSemanticArtifacts(
          missingHistorical.map((question) => ({
            id: question.id,
            semanticEmbedding: question.semanticEmbedding,
          })),
        );
        metrics.persistedHistoricalEmbeddings += missingHistorical.length;
      }

      if (transientEmbeddingResult) {
        addEmbeddingMetrics(metrics, transientEmbeddingResult);
        missingTransient.forEach((question, index) => {
          question.semanticEmbedding =
            transientEmbeddingResult.embeddings[index] ?? [];
        });
      }
    } catch (error) {
      logger.warn(
        { err: error },
        "Semantic duplicate detection failed; falling back to deterministic checks.",
      );
      return {
        acceptedQuestions: lexicallyAccepted,
        conflicts,
        metrics,
      };
    }

    const resolvedTransientReferences = [...semanticSeedReferences];
    const semanticallyAccepted: ValidatedQuestionPayload[] = [];

    for (const question of lexicallyAccepted) {
      const semanticConflict = this.findSemanticConflict(
        question,
        context,
        existingById,
        historicalById,
        resolvedTransientReferences,
        options?.excludeQuestionId,
      );

      if (semanticConflict) {
        metrics.semanticConflictCount += 1;
        conflicts.push(semanticConflict);
        continue;
      }

      semanticallyAccepted.push(question);
      resolvedTransientReferences.push(
        this.toReference(
          question,
          `semantic-accepted-${resolvedTransientReferences.length + 1}`,
        ),
      );
    }

    return {
      acceptedQuestions: semanticallyAccepted,
      conflicts,
      metrics,
    };
  }

  async assertNoConflicts(
    questions: ValidatedQuestionPayload[],
    context: DuplicateContext,
    excludeQuestionId?: string,
    transientQuestions?: TransientQuestionReference[],
  ) {
    const assessment = await this.assessQuestions(questions, context, {
      excludeQuestionId,
      transientQuestions,
    });

    if (assessment.conflicts.length > 0) {
      throw new Error(
        assessment.conflicts[0]?.message ??
          "Generated question conflicts with existing data.",
      );
    }
  }

  private recordConflictMetrics(
    metrics: DuplicateAssessmentMetrics,
    classification: DeterministicConflict["classification"],
  ) {
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

  private findDeterministicConflict(
    question: ValidatedQuestionPayload,
    context: DuplicateContext,
    acceptedReferences: TransientQuestionReference[],
    excludeQuestionId?: string,
  ): DeterministicConflict | null {
    for (const acceptedQuestion of acceptedReferences) {
      const exactConflict = this.matchExact(
        question,
        acceptedQuestion,
        "accepted_attempt",
      );
      if (exactConflict) return exactConflict;
    }

    for (const existingQuestion of context.existingQuestions) {
      if (excludeQuestionId && existingQuestion.id === excludeQuestionId)
        continue;

      const exactConflict = this.matchExact(
        question,
        existingQuestion,
        "existing_question_bank",
      );
      if (exactConflict) return exactConflict;
    }

    for (const historicalQuestion of context.historicalQuestions) {
      const exactConflict = this.matchExact(
        question,
        historicalQuestion,
        "historical_paper",
      );
      if (exactConflict) return exactConflict;
    }

    return null;
  }

  private matchExact(
    question: ValidatedQuestionPayload,
    reference: DuplicateReference,
    source: DuplicateConflict["source"],
  ): DeterministicConflict | null {
    if (reference.normalizedHash !== question.normalizedHash) {
      return null;
    }

    return {
      question,
      source,
      classification: "exact",
      message:
        source === "historical_paper"
          ? "Generated question matches a historical paper question exactly."
          : "Generated question matches an existing question exactly.",
    };
  }

  private findSemanticConflict(
    question: ValidatedQuestionPayload,
    context: DuplicateContext,
    existingById: Map<string, DuplicateReference>,
    historicalById: Map<string, DuplicateReference>,
    transientReferences: TransientQuestionReference[],
    excludeQuestionId?: string,
  ): DuplicateConflict | null {
    for (const transientQuestion of transientReferences) {
      if (!this.shouldConsiderForSemanticCheck(question, transientQuestion)) {
        continue;
      }

      const embedding = transientQuestion.semanticEmbedding ?? [];

      if (
        this.isSemanticDuplicate(
          question.text,
          transientQuestion.text,
          question.semanticEmbedding ?? [],
          embedding,
        )
      ) {
        return {
          question,
          source: "accepted_attempt_semantic",
          message:
            "Generated question is semantically too similar to another accepted question from this generation run.",
        };
      }
    }

    for (const [id, existingQuestion] of existingById.entries()) {
      if (excludeQuestionId && id === excludeQuestionId) continue;
      if (!this.shouldConsiderForSemanticCheck(question, existingQuestion)) {
        continue;
      }

      const embedding = existingQuestion.semanticEmbedding ?? [];
      if (
        this.isSemanticDuplicate(
          question.text,
          existingQuestion.text,
          question.semanticEmbedding ?? [],
          embedding,
        )
      ) {
        return {
          question,
          source: "existing_question_bank_semantic",
          message:
            "Generated question is semantically too similar to an existing question.",
        };
      }
    }

    for (const historicalQuestion of historicalById.values()) {
      if (!this.shouldConsiderForSemanticCheck(question, historicalQuestion)) {
        continue;
      }

      const embedding = historicalQuestion.semanticEmbedding ?? [];
      if (
        this.isSemanticDuplicate(
          question.text,
          historicalQuestion.text,
          question.semanticEmbedding ?? [],
          embedding,
        )
      ) {
        return {
          question,
          source: "historical_paper_semantic",
          message:
            "Generated question is semantically too similar to a historical paper question.",
        };
      }
    }

    return null;
  }

  private toReference(
    question: ValidatedQuestionPayload,
    id: string,
  ): TransientQuestionReference {
    return {
      id,
      text: question.text,
      normalizedHash: question.normalizedHash,
      structuralFingerprint: question.structuralFingerprint,
      semanticEmbedding: question.semanticEmbedding,
    };
  }

  private shouldConsiderForSemanticCheck(
    question: Pick<ValidatedQuestionPayload, "text" | "structuralFingerprint">,
    reference: Pick<DuplicateReference, "text" | "structuralFingerprint">,
  ) {
    if (question.structuralFingerprint === reference.structuralFingerprint) {
      return true;
    }

    return (
      structuralSimilarity(question.text, reference.text) >=
        SEMANTIC_PREFILTER_THRESHOLD ||
      jaccardSimilarity(question.text, reference.text) >=
        SEMANTIC_PREFILTER_THRESHOLD
    );
  }

  private isSemanticDuplicate(
    leftText: string,
    rightText: string,
    leftEmbedding: number[],
    rightEmbedding: number[],
  ) {
    if (leftEmbedding.length === 0 || rightEmbedding.length === 0) {
      return false;
    }

    const lexicalSimilarity = jaccardSimilarity(leftText, rightText);
    const structuralScore = structuralSimilarity(leftText, rightText);
    if (
      lexicalSimilarity < SEMANTIC_LEXICAL_GATE &&
      structuralScore < SEMANTIC_LEXICAL_GATE
    ) {
      return false;
    }

    return (
      cosineSimilarity(leftEmbedding, rightEmbedding) >=
      env.SEMANTIC_SIMILARITY_THRESHOLD
    );
  }
}
