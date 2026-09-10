import { AppError } from "../errors/app-error";
import { logger } from "../config/logger";
import { HistoricalAnalysisService } from "./historical-analysis.service";
import { validateProviderCandidates } from "./generation/output-validator";
import { PROMPT_VERSION } from "./generation/prompt-template";
import type {
  GenerationProviderRequest,
  QuestionQualityReview,
  QuestionGenerationProvider,
  ValidatedQuestionPayload,
} from "./generation/types";
import { env } from "../config/env";
import { DuplicateDetectionService } from "./duplicate-detection.service";
import type {
  ClassLevel,
  Difficulty,
  DifficultyMix,
  SubjectConfiguration,
  TargetExam,
} from "../constants/domain";
import { SyllabusGroundingService } from "./syllabus-grounding.service";
import {
  countByDifficulty,
  mixToCounts,
  subtractDifficultyCounts,
  totalDifficultyCount,
} from "../utils/difficulty";
import { normalizeText } from "../utils/normalization";
import { buildGenerationPlan } from "./generation/plan-builder";
import type { Question } from "../entities/question.entity";

const MAX_PROMPT_QUESTION_CONTEXT = 10;

function selectRequiredDifficultyMix(
  candidates: ValidatedQuestionPayload[],
  remainingCounts: DifficultyMix,
) {
  const availableSlots = { ...remainingCounts };

  return candidates.filter((question) => {
    if (availableSlots[question.difficulty] <= 0) {
      return false;
    }

    availableSlots[question.difficulty] -= 1;
    return true;
  });
}

function toReusableQuestionPayload(
  question: Question,
): ValidatedQuestionPayload {
  return {
    subject: question.subject,
    classLevel: question.classLevel,
    chapter: question.chapter,
    subTopic: question.subTopic,
    targetExams: question.targetExams,
    difficulty: question.difficulty,
    text: question.text,
    options: question.options,
    correctOption:
      question.correctOption as ValidatedQuestionPayload["correctOption"],
    correctIndex: question.correctIndex,
    conceptTested: question.conceptTested,
    commonMistake: question.commonMistake,
    recommendedRemedialAction: question.recommendedRemedialAction,
    learningOutcome: question.learningOutcome,
    bloomsTaxonomyLevel: question.bloomsTaxonomyLevel,
    examRelevance: question.examRelevance,
    sourceReference: question.sourceReference,
    normalizedText: question.normalizedText,
    normalizedHash: question.normalizedHash,
    structuralFingerprint: question.structuralFingerprint,
    semanticEmbedding: null,
    metadata: {
      ...(question.metadata ?? {}),
      reusedFromQuestionId: question.id,
      fallbackReason: "generation_or_repair_exhausted",
    },
  };
}

export function shouldAcceptAcademicReview(
  question: ValidatedQuestionPayload,
  review: QuestionQualityReview | undefined,
) {
  if (!review) return false;
  if (review.accepted) return true;

  const planSlot = question.metadata.generationPlanSlot as
    { difficulty?: unknown; questionForm?: unknown } | null | undefined;
  const difficultyRationale = question.metadata.difficultyRationale;
  const issues = review.issues.map((issue) => issue.toLowerCase());
  const onlyDifficultyDisagreement =
    issues.length > 0 &&
    issues.every((issue) =>
      ["difficulty", "medium", "hard", "rubric", "level"].some((keyword) =>
        issue.includes(keyword),
      ),
    );
  const clearlyTooEasy = issues.some((issue) =>
    ["easy", "one-step", "one step", "direct", "routine", "trivial"].some(
      (keyword) => issue.includes(keyword),
    ),
  );

  return (
    question.difficulty === "Hard" &&
    planSlot?.difficulty === "Hard" &&
    typeof planSlot.questionForm === "string" &&
    typeof difficultyRationale === "string" &&
    difficultyRationale.trim().length >= 8 &&
    onlyDifficultyDisagreement &&
    !clearlyTooEasy &&
    review.independentCorrectOption === question.correctOption &&
    review.syllabusAligned &&
    review.unambiguous &&
    review.metadataAligned &&
    review.verificationSummary.trim().length >= 8
  );
}

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
  historicalAnalysisSummary: Awaited<
    ReturnType<HistoricalAnalysisService["analyseSubjectConfiguration"]>
  >;
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

    const historicalAnalysisSummary =
      await this.historicalAnalysisService.analyseSubjectConfiguration(
        input.subjectConfiguration,
        input.targetExams,
      );
    logger.info(
      {
        subject: input.subjectConfiguration.subject,
        mode: historicalAnalysisSummary.mode,
        totalRelevantQuestions:
          historicalAnalysisSummary.totalRelevantQuestions,
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
    const rejectedQuestions: ValidatedQuestionPayload[] = [];
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
      academicReviewCallCount: 0,
      academicReviewRejectedCount: 0,
      academicReviewPromptTokens: 0,
      academicReviewCompletionTokens: 0,
      academicReviewTotalTokens: 0,
      exactConflictCount: 0,
      lexicalConflictCount: 0,
      structuralConflictCount: 0,
      semanticConflictCount: 0,
      embeddingPromptTokens: 0,
      embeddingTotalTokens: 0,
    };

    const buildPreviousQuestions = (attempt = 1) => {
      const compact = (text: string) =>
        text.replace(/\s+/g, " ").trim().slice(0, 160);
      const bankReferences = [
        ...duplicateContext.existingQuestions,
        ...duplicateContext.historicalQuestions,
      ];
      const distinctStructuralReferences: typeof bankReferences = [];
      const repeatedStructuralReferences: typeof bankReferences = [];
      const seenStructuralFingerprints = new Set<string>();

      for (const reference of bankReferences) {
        if (seenStructuralFingerprints.has(reference.structuralFingerprint)) {
          repeatedStructuralReferences.push(reference);
          continue;
        }

        seenStructuralFingerprints.add(reference.structuralFingerprint);
        distinctStructuralReferences.push(reference);
      }

      const rotateReferences = (references: typeof bankReferences) => {
        if (references.length === 0) return references;
        const ordered = [...references].sort((left, right) =>
          left.normalizedHash.localeCompare(right.normalizedHash),
        );
        const offset = ((attempt - 1) * 31) % ordered.length;
        return [...ordered.slice(offset), ...ordered.slice(0, offset)];
      };

      const prioritized = [
        ...acceptedQuestions.map((question) => question.text),
        ...rejectedQuestionTexts.slice(-16),
        ...input.previousQuestionTexts.slice(-12),
        ...rotateReferences(distinctStructuralReferences).map(
          (question) => question.text,
        ),
        ...rotateReferences(repeatedStructuralReferences).map(
          (question) => question.text,
        ),
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

        if (compacted.length >= MAX_PROMPT_QUESTION_CONTEXT) {
          break;
        }
      }

      return compacted;
    };

    let lastError: unknown = null;

    for (
      let attempt = 1;
      attempt <= env.QUESTION_GENERATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const acceptedCounts = countByDifficulty(acceptedQuestions);
        const remainingDifficultyCounts = subtractDifficultyCounts(
          targetDifficultyCounts,
          acceptedCounts,
        );
        const remainingQuestionCount = totalDifficultyCount(
          remainingDifficultyCounts,
        );

        if (remainingQuestionCount === 0) {
          break;
        }

        const isRepairAttempt = attempt > 1;
        const candidateDifficultyCounts = { ...remainingDifficultyCounts };
        const candidateQuestionCount = totalDifficultyCount(
          candidateDifficultyCounts,
        );
        const attemptRequest: GenerationProviderRequest = {
          ...request,
          questionCount: candidateQuestionCount,
          difficultyCounts: candidateDifficultyCounts,
          selectionDifficultyCounts:
            candidateQuestionCount > remainingQuestionCount
              ? remainingDifficultyCounts
              : undefined,
          previousQuestions: buildPreviousQuestions(attempt),
          generationPlan: buildGenerationPlan({
            ...request,
            questionCount: candidateQuestionCount,
            difficultyCounts: candidateDifficultyCounts,
            diversityOffset:
              duplicateContext.existingQuestions.length +
              duplicateContext.historicalQuestions.length +
              acceptedQuestions.length +
              rejectedQuestionTexts.length +
              (attempt - 1) * 131,
          }),
          retryContext:
            attempt > 1
              ? {
                  attempt,
                  acceptedQuestionTexts: acceptedQuestions.map(
                    (question) => question.text,
                  ),
                  rejectedQuestionTexts: rejectedQuestionTexts.slice(-10),
                  rejectionReasons: [...new Set(rejectionReasons)].slice(-6),
                  requiredDifficultyCounts: remainingDifficultyCounts,
                }
              : undefined,
        };

        logger.info(
          {
            subject: request.subject,
            attempt,
            maxAttempts: env.QUESTION_GENERATION_MAX_ATTEMPTS,
            questionCount: attemptRequest.questionCount,
            requiredPaperSlots: remainingQuestionCount,
            acceptedQuestionCount: acceptedQuestions.length,
            remainingDifficultyCounts,
            candidateDifficultyCounts,
            isRepairAttempt,
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
            completionTokens:
              providerResult.metrics?.usage?.completionTokens ?? 0,
            cachedPromptTokens:
              providerResult.metrics?.usage?.cachedPromptTokens ?? 0,
            providerLatencyMs: providerResult.metrics?.latencyMs ?? null,
          },
          "Question generation provider returned a response.",
        );
        aggregateMetrics.chatCallCount +=
          providerResult.metrics?.callCount ?? 1;
        aggregateMetrics.promptTokens +=
          providerResult.metrics?.usage?.promptTokens ?? 0;
        aggregateMetrics.completionTokens +=
          providerResult.metrics?.usage?.completionTokens ?? 0;
        aggregateMetrics.totalTokens +=
          providerResult.metrics?.usage?.totalTokens ?? 0;
        aggregateMetrics.cachedPromptTokens +=
          providerResult.metrics?.usage?.cachedPromptTokens ?? 0;
        aggregateMetrics.promptCharacters +=
          providerResult.metrics?.promptCharacters ?? 0;
        aggregateMetrics.responseCharacters +=
          providerResult.metrics?.responseCharacters ?? 0;
        const candidateValidation = validateProviderCandidates(
          attemptRequest,
          providerResult,
        );
        const validatedQuestions = candidateValidation.acceptedQuestions;
        if (candidateValidation.rejectedQuestions.length > 0) {
          rejectedQuestionTexts.push(
            ...candidateValidation.rejectedQuestions.flatMap((rejection) =>
              rejection.questionText ? [rejection.questionText] : [],
            ),
          );
          rejectionReasons.push(
            ...candidateValidation.rejectedQuestions.map(
              (rejection) => `${rejection.code}: ${rejection.message}`,
            ),
          );
        }
        logger.info(
          {
            subject: request.subject,
            attempt,
            validatedQuestionCount: validatedQuestions.length,
            rejectedQuestionCount: candidateValidation.rejectedQuestions.length,
          },
          "Generated candidates were validated independently.",
        );

        const duplicateAssessment =
          await this.duplicateDetectionService.assessQuestions(
            validatedQuestions,
            duplicateContext,
            {
              excludeQuestionId: input.excludeQuestionId,
              transientQuestions: [
                ...acceptedQuestions,
                ...rejectedQuestions,
              ].map((question, index) => ({
                id: `generation-run-candidate-${index + 1}`,
                text: question.text,
                normalizedHash: question.normalizedHash,
                structuralFingerprint: question.structuralFingerprint,
                semanticEmbedding: question.semanticEmbedding,
              })),
            },
          );
        aggregateMetrics.embeddingCallCount +=
          duplicateAssessment.metrics.embeddingCallCount;
        aggregateMetrics.embeddingPromptTokens +=
          duplicateAssessment.metrics.embeddingPromptTokens;
        aggregateMetrics.embeddingTotalTokens +=
          duplicateAssessment.metrics.embeddingTotalTokens;
        aggregateMetrics.exactConflictCount +=
          duplicateAssessment.metrics.exactConflictCount;
        aggregateMetrics.lexicalConflictCount +=
          duplicateAssessment.metrics.lexicalConflictCount;
        aggregateMetrics.structuralConflictCount +=
          duplicateAssessment.metrics.structuralConflictCount;
        aggregateMetrics.semanticConflictCount +=
          duplicateAssessment.metrics.semanticConflictCount;

        let academicallyAcceptedQuestions =
          duplicateAssessment.acceptedQuestions;
        let academicReviewResult: Awaited<
          ReturnType<NonNullable<QuestionGenerationProvider["reviewQuestions"]>>
        > | null = null;

        if (
          env.ACADEMIC_REVIEW_ENABLED &&
          this.provider.reviewQuestions &&
          duplicateAssessment.acceptedQuestions.length > 0
        ) {
          academicReviewResult = await this.provider.reviewQuestions(
            attemptRequest,
            duplicateAssessment.acceptedQuestions,
          );
          aggregateMetrics.academicReviewCallCount +=
            academicReviewResult.metrics?.callCount ?? 1;
          aggregateMetrics.academicReviewPromptTokens +=
            academicReviewResult.metrics?.usage?.promptTokens ?? 0;
          aggregateMetrics.academicReviewCompletionTokens +=
            academicReviewResult.metrics?.usage?.completionTokens ?? 0;
          aggregateMetrics.academicReviewTotalTokens +=
            academicReviewResult.metrics?.usage?.totalTokens ?? 0;

          const reviewsByIndex = new Map(
            academicReviewResult.reviews.map((review) => [
              review.candidateIndex - 1,
              review,
            ]),
          );
          const academicDecisions = duplicateAssessment.acceptedQuestions.map(
            (question, index) => {
              const review = reviewsByIndex.get(index);
              const accepted = shouldAcceptAcademicReview(question, review);
              return {
                question,
                review,
                accepted,
                difficultyCalibrationApplied:
                  accepted && review?.accepted !== true,
              };
            },
          );
          const academicRejections = academicDecisions.filter(
            ({ accepted }) => !accepted,
          );
          const calibratedAcceptanceCount = academicDecisions.filter(
            ({ difficultyCalibrationApplied }) => difficultyCalibrationApplied,
          ).length;
          academicallyAcceptedQuestions = academicDecisions.flatMap(
            ({ question, review, accepted, difficultyCalibrationApplied }) => {
              if (!accepted || !review) return [];

              return [
                {
                  ...question,
                  metadata: {
                    ...question.metadata,
                    academicReview: {
                      provider: academicReviewResult?.provider,
                      model: academicReviewResult?.model,
                      ...review,
                      difficultyCalibrationApplied,
                    },
                  },
                },
              ];
            },
          );
          aggregateMetrics.academicReviewRejectedCount +=
            academicRejections.length;

          if (academicRejections.length > 0) {
            rejectedQuestions.push(
              ...academicRejections.map(({ question }) => question),
            );
            rejectedQuestionTexts.push(
              ...academicRejections.map(({ question }) => question.text),
            );
            rejectionReasons.push(
              ...academicRejections.flatMap(({ review }) =>
                review?.issues.length
                  ? review.issues.map((issue) => `Academic review: ${issue}`)
                  : [
                      "Academic review rejected the candidate without a usable reason.",
                    ],
              ),
            );
            logger.warn(
              {
                subject: request.subject,
                attempt,
                reviewedCandidateCount:
                  duplicateAssessment.acceptedQuestions.length,
                academicallyAcceptedCount: academicallyAcceptedQuestions.length,
                academicallyRejectedCount: academicRejections.length,
                calibratedAcceptanceCount,
                rejectionIssues: academicRejections
                  .flatMap(({ review }) => review?.issues ?? [])
                  .slice(0, 8),
              },
              "Independent academic review rejected generated candidates. Retrying the affected slots.",
            );
          }
        }

        const selectedQuestions = selectRequiredDifficultyMix(
          academicallyAcceptedQuestions,
          remainingDifficultyCounts,
        );
        acceptedQuestions.push(...selectedQuestions);

        if (duplicateAssessment.conflicts.length > 0) {
          rejectedQuestions.push(
            ...duplicateAssessment.conflicts.map(
              (conflict) => conflict.question,
            ),
          );
          rejectedQuestionTexts.push(
            ...duplicateAssessment.conflicts.map(
              (conflict) => conflict.question.text,
            ),
          );
          rejectionReasons.push(
            ...duplicateAssessment.conflicts.map(
              (conflict) => conflict.message,
            ),
          );
          logger.warn(
            {
              subject: request.subject,
              attempt,
              uniqueCandidatesThisAttempt:
                duplicateAssessment.acceptedQuestions.length,
              academicallyAcceptedThisAttempt:
                academicallyAcceptedQuestions.length,
              selectedThisAttempt: selectedQuestions.length,
              acceptedTotal: acceptedQuestions.length,
              remainingQuestionCount:
                input.subjectConfiguration.numberOfQuestions -
                acceptedQuestions.length,
              conflictCount: duplicateAssessment.conflicts.length,
              conflictMessages: [
                ...new Set(
                  duplicateAssessment.conflicts.map(
                    (conflict) => conflict.message,
                  ),
                ),
              ].slice(0, 4),
            },
            "Generated batch contained duplicate conflicts. Keeping the unique questions and retrying only the remaining slots.",
          );
        }

        attemptSummaries.push({
          attempt,
          requestedQuestionCount: attemptRequest.questionCount,
          requiredPaperSlots: remainingQuestionCount,
          uniqueCandidateCount: duplicateAssessment.acceptedQuestions.length,
          academicallyAcceptedCandidateCount:
            academicallyAcceptedQuestions.length,
          selectedQuestionCount: selectedQuestions.length,
          unusedReserveCount:
            academicallyAcceptedQuestions.length - selectedQuestions.length,
          conflictCount: duplicateAssessment.conflicts.length,
          academicRejectionCount:
            duplicateAssessment.acceptedQuestions.length -
            academicallyAcceptedQuestions.length,
          provider: providerResult.provider,
          model: providerResult.model,
          generationPlan: attemptRequest.generationPlan,
          providerMetrics: providerResult.metrics ?? null,
          academicReviewProvider: academicReviewResult?.provider ?? null,
          academicReviewModel: academicReviewResult?.model ?? null,
          academicReviewMetrics: academicReviewResult?.metrics ?? null,
          academicReviewResponse: academicReviewResult?.rawResponse ?? null,
          duplicateMetrics: duplicateAssessment.metrics,
        });

        if (
          acceptedQuestions.length !==
          input.subjectConfiguration.numberOfQuestions
        ) {
          if (attempt < env.QUESTION_GENERATION_MAX_ATTEMPTS) {
            continue;
          }

          lastError = new AppError(
            409,
            "QUESTION_GENERATION_UNIQUE_EXHAUSTED",
            "The generator could not produce enough unique non-repeating questions for this syllabus slice within the retry limit.",
            {
              requestedQuestionCount:
                input.subjectConfiguration.numberOfQuestions,
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

    const remainingBeforeFallback =
      input.subjectConfiguration.numberOfQuestions - acceptedQuestions.length;

    if (remainingBeforeFallback > 0) {
      const reusableQuestions =
        await this.duplicateDetectionService.findReusableQuestions({
          subject: input.subjectConfiguration.subject,
          classLevel: input.classLevel,
          chapter: input.subjectConfiguration.chapter,
          subTopic: input.subjectConfiguration.subTopic,
          excludePaperId: input.excludePaperId,
          limit: 60,
        });
      const seenHashes = new Set(
        acceptedQuestions.map((question) => question.normalizedHash),
      );
      const remainingCounts = subtractDifficultyCounts(
        targetDifficultyCounts,
        countByDifficulty(acceptedQuestions),
      );
      const unused = reusableQuestions.filter(
        (question) => !seenHashes.has(question.normalizedHash),
      );
      const selectedReusable: ValidatedQuestionPayload[] = [];

      for (const difficulty of ["Easy", "Medium", "Hard"] as Difficulty[]) {
        for (const question of unused) {
          if (remainingCounts[difficulty] <= 0) break;
          if (
            question.difficulty !== difficulty ||
            seenHashes.has(question.normalizedHash)
          ) {
            continue;
          }

          selectedReusable.push(toReusableQuestionPayload(question));
          seenHashes.add(question.normalizedHash);
          remainingCounts[difficulty] -= 1;
        }
      }

      for (const question of unused) {
        if (
          acceptedQuestions.length + selectedReusable.length >=
          input.subjectConfiguration.numberOfQuestions
        ) {
          break;
        }
        if (seenHashes.has(question.normalizedHash)) continue;

        selectedReusable.push(toReusableQuestionPayload(question));
        seenHashes.add(question.normalizedHash);
      }

      acceptedQuestions.push(...selectedReusable);

      if (
        acceptedQuestions.length ===
        input.subjectConfiguration.numberOfQuestions
      ) {
        logger.warn(
          {
            subject: request.subject,
            reusedQuestionCount: selectedReusable.length,
            generatedQuestionCount:
              acceptedQuestions.length - selectedReusable.length,
          },
          "Generation attempts were incomplete; filled the remaining paper slots from the exact-syllabus question bank.",
        );

        return {
          questions: acceptedQuestions,
          generationRun: {
            status: "completed",
            provider: "question-bank-fallback",
            model: "persisted-syllabus-questions",
            promptVersion: PROMPT_VERSION,
            requestPayload: {
              ...request,
              targetDifficultyCounts,
              previousQuestions: buildPreviousQuestions(),
            } as unknown as Record<string, unknown>,
            responsePayload: {
              attempts: attemptSummaries,
              fallback: {
                reusedQuestionCount: selectedReusable.length,
                reason:
                  lastError instanceof Error
                    ? lastError.message
                    : "Generation attempts did not fill every paper slot.",
              },
            },
            validationReport: {
              attempt: env.QUESTION_GENERATION_MAX_ATTEMPTS,
              validatedQuestionCount: acceptedQuestions.length,
              attemptSummaries,
              fallbackUsed: true,
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
    }

    if (lastError instanceof AppError) {
      throw lastError;
    }

    throw new AppError(
      502,
      "QUESTION_GENERATION_FAILED",
      "Question generation failed after all retry attempts.",
      {
        reason:
          lastError instanceof Error
            ? lastError.message
            : "Unknown generation error",
      },
    );
  }
}
