import { AppError } from "../errors/app-error";
import { logger } from "../config/logger";
import { HistoricalAnalysisService } from "./historical-analysis.service";
import { validateProviderOutput } from "./generation/output-validator";
import { PROMPT_VERSION } from "./generation/prompt-template";
import type {
  GenerationProviderRequest,
  QuestionGenerationProvider,
  ValidatedQuestionPayload,
} from "./generation/types";
import { env } from "../config/env";
import { DuplicateDetectionService } from "./duplicate-detection.service";
import type { SubjectConfiguration, TargetExam, ClassLevel } from "../constants/domain";
import { SyllabusGroundingService } from "./syllabus-grounding.service";
import {
  countByDifficulty,
  mixToCounts,
  subtractDifficultyCounts,
  totalDifficultyCount,
} from "../utils/difficulty";
import { normalizeText } from "../utils/normalization";
import { buildGenerationPlan } from "./generation/plan-builder";

export interface SubjectGenerationResult {
  questions: ValidatedQuestionPayload[];
  generationRun: {
    status: "completed";
    provider: string;
    model: string;
    promptVersion: string;
    requestPayload: Record<string, unknown>;
    responsePayload: Record<string, unknown>;
    validationReport: Record<string, unknown>;
    failureReason: null;
  };
  historicalAnalysisSummary: Awaited<ReturnType<HistoricalAnalysisService["analyseSubjectConfiguration"]>>;
}

export class QuestionGenerationService {
  constructor(
    private readonly provider: QuestionGenerationProvider,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly historicalAnalysisService: HistoricalAnalysisService,
    private readonly syllabusGroundingService: SyllabusGroundingService,
  ) {}

  async generateForSubject(input: {
    subjectConfiguration: SubjectConfiguration;
    classLevel: ClassLevel;
    targetExams: TargetExam[];
    previousQuestionTexts: string[];
    excludePaperId?: string;
    excludeQuestionId?: string;
  }): Promise<SubjectGenerationResult> {
    const startedAt = Date.now();
    logger.info(
      {
        subject: input.subjectConfiguration.subject,
        classLevel: input.classLevel,
        chapter: input.subjectConfiguration.chapter,
        subTopic: input.subjectConfiguration.subTopic,
        questionCount: input.subjectConfiguration.numberOfQuestions,
        targetExams: input.targetExams,
        provider: this.provider.constructor.name,
      },
      "Question generation started for subject configuration.",
    );

    const historicalAnalysisSummary = await this.historicalAnalysisService.analyseSubjectConfiguration(
      input.subjectConfiguration,
      input.targetExams,
    );
    logger.info(
      {
        subject: input.subjectConfiguration.subject,
        mode: historicalAnalysisSummary.mode,
        totalRelevantQuestions: historicalAnalysisSummary.totalRelevantQuestions,
        yearsCovered: historicalAnalysisSummary.yearsCovered,
      },
      "Historical analysis prepared for generation.",
    );

    const syllabusContext = this.syllabusGroundingService.resolve({
      subject: input.subjectConfiguration.subject,
      chapter: input.subjectConfiguration.chapter,
      subTopic: input.subjectConfiguration.subTopic,
    });
    logger.info(
      {
        subject: input.subjectConfiguration.subject,
        chapter: input.subjectConfiguration.chapter,
        subTopic: input.subjectConfiguration.subTopic,
        syllabusEntryKey: syllabusContext.entryKey,
        canonicalMatch: syllabusContext.canonicalMatch,
        matchScore: syllabusContext.matchScore,
        coreConceptCount: syllabusContext.coreConcepts.length,
      },
      "Syllabus grounding resolved for generation.",
    );

    const duplicateContext = await this.duplicateDetectionService.buildContext({
      subject: input.subjectConfiguration.subject,
      classLevel: input.classLevel,
      chapter: input.subjectConfiguration.chapter,
      subTopic: input.subjectConfiguration.subTopic,
      excludePaperId: input.excludePaperId,
    });
    logger.info(
      {
        subject: input.subjectConfiguration.subject,
        existingQuestionCount: duplicateContext.existingQuestions.length,
        historicalQuestionCount: duplicateContext.historicalQuestions.length,
      },
      "Duplicate detection context prepared.",
    );

    const request: GenerationProviderRequest = {
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

    const targetDifficultyCounts = mixToCounts(
      input.subjectConfiguration.mix,
      input.subjectConfiguration.numberOfQuestions,
    );
    const acceptedQuestions: ValidatedQuestionPayload[] = [];
    const rejectedQuestionTexts: string[] = [];
    const rejectionReasons: string[] = [];
    const attemptSummaries: Array<Record<string, unknown>> = [];
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
      const compact = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 120);
      const prioritized = [
        ...acceptedQuestions.map((question) => question.text),
        ...rejectedQuestionTexts.slice(-4),
        ...input.previousQuestionTexts.slice(-4),
        ...duplicateContext.existingQuestions.slice(0, 8).map((question) => question.text),
        ...duplicateContext.historicalQuestions.slice(0, 4).map((question) => question.text),
      ];

      const seen = new Set<string>();
      const compacted: string[] = [];

      for (const text of prioritized) {
        const normalized = normalizeText(text);
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

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= env.QUESTION_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        const acceptedCounts = countByDifficulty(acceptedQuestions);
        const remainingDifficultyCounts = subtractDifficultyCounts(targetDifficultyCounts, acceptedCounts);
        const remainingQuestionCount = totalDifficultyCount(remainingDifficultyCounts);

        if (remainingQuestionCount === 0) {
          break;
        }

        const attemptRequest: GenerationProviderRequest = {
          ...request,
          questionCount: remainingQuestionCount,
          difficultyCounts: remainingDifficultyCounts,
          previousQuestions: buildPreviousQuestions(),
          generationPlan: buildGenerationPlan({
            ...request,
            questionCount: remainingQuestionCount,
            difficultyCounts: remainingDifficultyCounts,
          }),
          retryContext:
            attempt > 1
              ? {
                  attempt,
                  acceptedQuestionTexts: acceptedQuestions.map((question) => question.text),
                  rejectedQuestionTexts: rejectedQuestionTexts.slice(-10),
                  rejectionReasons: [...new Set(rejectionReasons)].slice(-6),
                }
              : undefined,
        };

        logger.info(
          {
            subject: request.subject,
            attempt,
            maxAttempts: env.QUESTION_GENERATION_MAX_ATTEMPTS,
            questionCount: attemptRequest.questionCount,
            acceptedQuestionCount: acceptedQuestions.length,
            remainingDifficultyCounts,
            promptExclusionCount: attemptRequest.previousQuestions.length,
            generationPlanSlots: attemptRequest.generationPlan.length,
          },
          "Question generation attempt started.",
        );

        const providerResult = await this.provider.generate(attemptRequest);
        logger.info(
          {
            subject: request.subject,
            attempt,
            provider: providerResult.provider,
            model: providerResult.model,
            generatedQuestionCount: providerResult.questions.length,
            promptTokens: providerResult.metrics?.usage?.promptTokens ?? 0,
            completionTokens: providerResult.metrics?.usage?.completionTokens ?? 0,
            cachedPromptTokens: providerResult.metrics?.usage?.cachedPromptTokens ?? 0,
            providerLatencyMs: providerResult.metrics?.latencyMs ?? null,
          },
          "Question generation provider returned a response.",
        );
        aggregateMetrics.chatCallCount += 1;
        aggregateMetrics.promptTokens += providerResult.metrics?.usage?.promptTokens ?? 0;
        aggregateMetrics.completionTokens += providerResult.metrics?.usage?.completionTokens ?? 0;
        aggregateMetrics.totalTokens += providerResult.metrics?.usage?.totalTokens ?? 0;
        aggregateMetrics.cachedPromptTokens += providerResult.metrics?.usage?.cachedPromptTokens ?? 0;
        aggregateMetrics.promptCharacters += providerResult.metrics?.promptCharacters ?? 0;
        aggregateMetrics.responseCharacters += providerResult.metrics?.responseCharacters ?? 0;
        const validatedQuestions = validateProviderOutput(attemptRequest, providerResult);
        logger.info(
          {
            subject: request.subject,
            attempt,
            validatedQuestionCount: validatedQuestions.length,
          },
          "Generated questions passed schema validation.",
        );

        const duplicateAssessment = await this.duplicateDetectionService.assessQuestions(
          validatedQuestions,
          duplicateContext,
          {
            excludeQuestionId: input.excludeQuestionId,
            transientQuestions: acceptedQuestions.map((question, index) => ({
              id: `accepted-${index + 1}`,
              text: question.text,
              normalizedHash: question.normalizedHash,
              structuralFingerprint: question.structuralFingerprint,
              semanticEmbedding: question.semanticEmbedding,
            })),
          },
        );
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
          rejectedQuestionTexts.push(
            ...duplicateAssessment.conflicts.map((conflict) => conflict.question.text),
          );
          rejectionReasons.push(...duplicateAssessment.conflicts.map((conflict) => conflict.message));
          logger.warn(
            {
              subject: request.subject,
              attempt,
              acceptedThisAttempt: duplicateAssessment.acceptedQuestions.length,
              acceptedTotal: acceptedQuestions.length,
              remainingQuestionCount:
                input.subjectConfiguration.numberOfQuestions - acceptedQuestions.length,
              conflictCount: duplicateAssessment.conflicts.length,
              conflictMessages: [
                ...new Set(duplicateAssessment.conflicts.map((conflict) => conflict.message)),
              ].slice(0, 4),
            },
            "Generated batch contained duplicate conflicts. Keeping the unique questions and retrying only the remaining slots.",
          );
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
          if (attempt < env.QUESTION_GENERATION_MAX_ATTEMPTS) {
            continue;
          }

          lastError = new AppError(
            409,
            "QUESTION_GENERATION_UNIQUE_EXHAUSTED",
            "The generator could not produce enough unique non-repeating questions for this syllabus slice within the retry limit.",
            {
              requestedQuestionCount: input.subjectConfiguration.numberOfQuestions,
              acceptedQuestionCount: acceptedQuestions.length,
              rejectionReasons: [...new Set(rejectionReasons)],
            },
          );
          continue;
        }

        logger.info(
          {
            subject: request.subject,
            attempt,
            validatedQuestionCount: acceptedQuestions.length,
            provider: providerResult.provider,
            model: providerResult.model,
            promptVersion: PROMPT_VERSION,
          },
          "Question generation completed successfully.",
        );

        return {
          questions: acceptedQuestions,
          generationRun: {
            status: "completed",
            provider: providerResult.provider,
            model: providerResult.model,
            promptVersion: PROMPT_VERSION,
            requestPayload: {
              ...request,
              targetDifficultyCounts,
              previousQuestions: buildPreviousQuestions(),
            } as unknown as Record<string, unknown>,
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
      } catch (error) {
        lastError = error;
        logger.warn(
          {
            subject: request.subject,
            attempt,
            maxAttempts: env.QUESTION_GENERATION_MAX_ATTEMPTS,
            err: error,
          },
          "Question generation attempt failed.",
        );
      }
    }

    if (lastError instanceof AppError) {
      throw lastError;
    }

    throw new AppError(
      502,
      "QUESTION_GENERATION_FAILED",
      "Question generation failed after all retry attempts.",
      {
        reason: lastError instanceof Error ? lastError.message : "Unknown generation error",
      },
    );
  }
}
