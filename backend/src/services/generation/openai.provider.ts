import { AppError } from "../../errors/app-error";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { buildQuestionPrompt } from "./prompt-builder";
import { PROMPT_VERSION } from "./prompt-template";
import type {
  EmbeddingCallResult,
  GenerationProviderRequest,
  GenerationProviderResult,
  ProviderCallMetrics,
  QuestionQualityReviewResult,
  QuestionGenerationProvider,
  ValidatedQuestionPayload,
} from "./types";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

interface EmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

interface QualityReviewResponse {
  reviews?: Array<{
    candidateIndex?: number;
    accepted?: boolean;
    independentCorrectOption?: unknown;
    syllabusAligned?: boolean;
    unambiguous?: boolean;
    difficultyAligned?: boolean;
    metadataAligned?: boolean;
    verificationSummary?: unknown;
    issues?: unknown[];
  }>;
}

const EXAM_RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    JEE_MAIN: { type: "string", enum: ["High", "Medium", "Low", "N/A"] },
    NEET: { type: "string", enum: ["High", "Medium", "Low", "N/A"] },
    KCET: { type: "string", enum: ["High", "Medium", "Low", "N/A"] },
    CBSE: { type: "string", enum: ["High", "Medium", "Low", "N/A"] },
  },
  required: ["JEE_MAIN", "NEET", "KCET", "CBSE"],
} as const;

const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questionNumber: { type: "integer", minimum: 1 },
    difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
    questionText: { type: "string", minLength: 10 },
    options: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string", minLength: 1 },
    },
    correctOption: { type: "string", enum: ["A", "B", "C", "D"] },
    conceptTested: { type: "string", minLength: 1 },
    commonMistake: { type: "string", minLength: 1 },
    recommendedRemedialAction: { type: "string", minLength: 1 },
    learningOutcome: { type: "string", minLength: 1 },
    bloomsTaxonomyLevel: { type: "string", minLength: 1 },
    examRelevance: EXAM_RELEVANCE_SCHEMA,
    sourceReference: { type: ["string", "null"] },
    solutionOutline: { type: "string", minLength: 8 },
    difficultyRationale: { type: "string", minLength: 8 },
  },
  required: [
    "questionNumber",
    "difficulty",
    "questionText",
    "options",
    "correctOption",
    "conceptTested",
    "commonMistake",
    "recommendedRemedialAction",
    "learningOutcome",
    "bloomsTaxonomyLevel",
    "examRelevance",
    "sourceReference",
    "solutionOutline",
    "difficultyRationale",
  ],
} as const;

const GENERATION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "question_paper_candidates",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        historicalAnalysisMode: {
          type: "string",
          enum: ["imported_dataset", "model_knowledge_fallback", "mixed"],
        },
        historicalAnalysisSummary: { type: "string" },
        questions: { type: "array", items: QUESTION_SCHEMA },
      },
      required: [
        "historicalAnalysisMode",
        "historicalAnalysisSummary",
        "questions",
      ],
    },
  },
} as const;

const REVIEW_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "academic_question_reviews",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reviews: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              candidateIndex: { type: "integer", minimum: 1 },
              accepted: { type: "boolean" },
              independentCorrectOption: {
                type: ["string", "null"],
                enum: ["A", "B", "C", "D", null],
              },
              syllabusAligned: { type: "boolean" },
              unambiguous: { type: "boolean" },
              difficultyAligned: { type: "boolean" },
              metadataAligned: { type: "boolean" },
              verificationSummary: { type: "string" },
              issues: { type: "array", items: { type: "string" } },
            },
            required: [
              "candidateIndex",
              "accepted",
              "independentCorrectOption",
              "syllabusAligned",
              "unambiguous",
              "difficultyAligned",
              "metadataAligned",
              "verificationSummary",
              "issues",
            ],
          },
        },
      },
      required: ["reviews"],
    },
  },
} as const;

function modelControls(
  model: string,
  reasoningEffort: string,
  temperature: number,
) {
  return model.startsWith("gpt-5")
    ? { reasoning_effort: reasoningEffort, verbosity: "low" }
    : { temperature };
}

export class OpenAiQuestionGenerationProvider implements QuestionGenerationProvider {
  async generate(
    request: GenerationProviderRequest,
  ): Promise<GenerationProviderResult> {
    if (
      request.questionCount <= env.OPENAI_GENERATION_BATCH_SIZE ||
      request.generationPlan.length !== request.questionCount
    ) {
      return this.generateQuestionBatch(request, 1, 1);
    }

    const planBatches = Array.from(
      {
        length: Math.ceil(
          request.generationPlan.length / env.OPENAI_GENERATION_BATCH_SIZE,
        ),
      },
      (_, index) =>
        request.generationPlan.slice(
          index * env.OPENAI_GENERATION_BATCH_SIZE,
          (index + 1) * env.OPENAI_GENERATION_BATCH_SIZE,
        ),
    );
    const batchRequests = planBatches.map((generationPlan) => {
      const difficultyCounts = generationPlan.reduce(
        (counts, slot) => {
          counts[slot.difficulty] += 1;
          return counts;
        },
        { Easy: 0, Medium: 0, Hard: 0 },
      );

      return {
        ...request,
        questionCount: generationPlan.length,
        difficultyCounts,
        selectionDifficultyCounts: undefined,
        generationPlan,
        retryContext: request.retryContext
          ? {
              ...request.retryContext,
              requiredDifficultyCounts: difficultyCounts,
            }
          : undefined,
      } satisfies GenerationProviderRequest;
    });
    const startedAt = Date.now();

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_MODEL,
        subject: request.subject,
        candidateCount: request.questionCount,
        batchCount: batchRequests.length,
        batchSize: env.OPENAI_GENERATION_BATCH_SIZE,
        concurrency: env.OPENAI_GENERATION_CONCURRENCY,
      },
      "Dispatching OpenAI question generation in focused batches.",
    );

    const batchResults: GenerationProviderResult[] = [];
    for (
      let batchOffset = 0;
      batchOffset < batchRequests.length;
      batchOffset += env.OPENAI_GENERATION_CONCURRENCY
    ) {
      const wave = batchRequests.slice(
        batchOffset,
        batchOffset + env.OPENAI_GENERATION_CONCURRENCY,
      );
      const waveResults = await Promise.all(
        wave.map((batchRequest, index) =>
          this.generateQuestionBatch(
            batchRequest,
            batchOffset + index + 1,
            batchRequests.length,
          ),
        ),
      );
      batchResults.push(...waveResults);
    }

    const sumMetric = (selector: (metrics: ProviderCallMetrics) => number) =>
      batchResults.reduce(
        (total, result) =>
          total + (result.metrics ? selector(result.metrics) : 0),
        0,
      );
    const questions = batchResults
      .flatMap((result) => result.questions)
      .map((question, index) => ({ ...question, questionNumber: index + 1 }));
    const historicalAnalysisModes = new Set(
      batchResults.map((result) => result.historicalAnalysisMode),
    );

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_MODEL,
        subject: request.subject,
        candidateCount: questions.length,
        batchCount: batchResults.length,
        latencyMs: Date.now() - startedAt,
      },
      "Focused OpenAI generation batches completed.",
    );

    return {
      rawPrompt: batchResults
        .map(
          (result, index) =>
            `Generation batch ${index + 1}:\n${result.rawPrompt}`,
        )
        .join("\n\n"),
      rawResponse: {
        batches: batchResults.map((result) => result.rawResponse),
      },
      provider: "openai",
      model: env.OPENAI_MODEL,
      questions,
      historicalAnalysisMode:
        historicalAnalysisModes.size === 1
          ? batchResults[0]!.historicalAnalysisMode
          : "mixed",
      historicalAnalysisSummary: Array.from(
        new Set(batchResults.map((result) => result.historicalAnalysisSummary)),
      ).join(" "),
      metrics: {
        provider: "openai",
        model: env.OPENAI_MODEL,
        callCount: batchResults.length,
        latencyMs: Date.now() - startedAt,
        promptCharacters: sumMetric((metrics) => metrics.promptCharacters),
        responseCharacters: sumMetric((metrics) => metrics.responseCharacters),
        usage: {
          promptTokens: batchResults.reduce(
            (total, result) =>
              total + (result.metrics?.usage?.promptTokens ?? 0),
            0,
          ),
          completionTokens: batchResults.reduce(
            (total, result) =>
              total + (result.metrics?.usage?.completionTokens ?? 0),
            0,
          ),
          totalTokens: batchResults.reduce(
            (total, result) =>
              total + (result.metrics?.usage?.totalTokens ?? 0),
            0,
          ),
          cachedPromptTokens: batchResults.reduce(
            (total, result) =>
              total + (result.metrics?.usage?.cachedPromptTokens ?? 0),
            0,
          ),
        },
      },
    };
  }

  private async generateQuestionBatch(
    request: GenerationProviderRequest,
    batchNumber: number,
    batchCount: number,
  ): Promise<GenerationProviderResult> {
    if (!env.OPENAI_API_KEY) {
      throw new AppError(
        503,
        "OPENAI_NOT_CONFIGURED",
        "OPENAI_API_KEY is required to generate questions.",
      );
    }

    const prompt = buildQuestionPrompt(request);
    const startedAt = Date.now();
    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_MODEL,
        promptVersion: PROMPT_VERSION,
        promptLength: prompt.length,
        subject: request.subject,
        questionCount: request.questionCount,
        batchNumber,
        batchCount,
      },
      "Dispatching focused OpenAI generation batch.",
    );

    const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        ...modelControls(
          env.OPENAI_MODEL,
          env.OPENAI_GENERATION_REASONING_EFFORT,
          env.QUESTION_GENERATION_TEMPERATURE,
        ),
        response_format: GENERATION_RESPONSE_FORMAT,
        messages: [
          {
            role: "system",
            content:
              "You are a careful educational content generator. Respond with JSON only and never include markdown fences. The field correctOption must be exactly one uppercase letter A, B, C, or D. The field questionText must contain only the stem and must never inline answer choices.",
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
      throw new AppError(
        502,
        "OPENAI_REQUEST_FAILED",
        "The OpenAI generation request failed.",
        { status: response.status, body },
      );
    }

    const parsed = (await response.json()) as ChatCompletionResponse;
    const content = parsed.choices?.[0]?.message?.content;

    if (!content) {
      throw new AppError(
        502,
        "OPENAI_EMPTY_RESPONSE",
        "The OpenAI response did not contain any generated content.",
      );
    }

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_MODEL,
        subject: request.subject,
        responseCharacters: content.length,
        latencyMs: Date.now() - startedAt,
        batchNumber,
        batchCount,
      },
      "Focused OpenAI generation batch completed.",
    );

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new AppError(
        502,
        "OPENAI_INVALID_JSON",
        "The OpenAI response was not valid JSON.",
        { content },
      );
    }

    return {
      rawPrompt: prompt,
      rawResponse: json,
      provider: "openai",
      model: env.OPENAI_MODEL,
      questions:
        (json.questions as GenerationProviderResult["questions"]) ?? [],
      historicalAnalysisMode:
        (json.historicalAnalysisMode as GenerationProviderResult["historicalAnalysisMode"]) ??
        request.historicalAnalysis.mode,
      historicalAnalysisSummary:
        (json.historicalAnalysisSummary as string) ??
        request.historicalAnalysis.trendSummary,
      metrics: {
        provider: "openai",
        model: env.OPENAI_MODEL,
        callCount: 1,
        latencyMs: Date.now() - startedAt,
        promptCharacters: prompt.length,
        responseCharacters: content.length,
        usage: {
          promptTokens: parsed.usage?.prompt_tokens ?? 0,
          completionTokens: parsed.usage?.completion_tokens ?? 0,
          totalTokens: parsed.usage?.total_tokens ?? 0,
          cachedPromptTokens:
            parsed.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        },
      },
    };
  }

  async reviewQuestions(
    request: GenerationProviderRequest,
    questions: ValidatedQuestionPayload[],
  ): Promise<QuestionQualityReviewResult> {
    if (!env.OPENAI_API_KEY) {
      throw new AppError(
        503,
        "OPENAI_NOT_CONFIGURED",
        "OPENAI_API_KEY is required to review generated questions.",
      );
    }

    const indexedQuestions = questions.map((question, index) => ({
      candidateIndex: index + 1,
      question,
    }));
    const batches = Array.from(
      {
        length: Math.ceil(
          indexedQuestions.length / env.OPENAI_REVIEW_BATCH_SIZE,
        ),
      },
      (_, index) =>
        indexedQuestions.slice(
          index * env.OPENAI_REVIEW_BATCH_SIZE,
          (index + 1) * env.OPENAI_REVIEW_BATCH_SIZE,
        ),
    );
    const startedAt = Date.now();

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        subject: request.subject,
        candidateCount: questions.length,
        batchCount: batches.length,
        batchSize: env.OPENAI_REVIEW_BATCH_SIZE,
        concurrency: env.OPENAI_REVIEW_CONCURRENCY,
      },
      "Dispatching independent academic quality review in focused batches.",
    );

    const batchResults: QuestionQualityReviewResult[] = [];
    for (
      let batchOffset = 0;
      batchOffset < batches.length;
      batchOffset += env.OPENAI_REVIEW_CONCURRENCY
    ) {
      const wave = batches.slice(
        batchOffset,
        batchOffset + env.OPENAI_REVIEW_CONCURRENCY,
      );
      const waveResults = await Promise.all(
        wave.map((batch, index) =>
          this.reviewQuestionBatch(
            request,
            batch,
            batchOffset + index + 1,
            batches.length,
          ),
        ),
      );
      batchResults.push(...waveResults);
    }

    const reviews = batchResults.flatMap((result) => result.reviews);
    const validIndexes = new Set(
      reviews.map((review) => review.candidateIndex),
    );
    if (
      reviews.length !== questions.length ||
      validIndexes.size !== questions.length ||
      reviews.some(
        (review) =>
          review.candidateIndex < 1 || review.candidateIndex > questions.length,
      )
    ) {
      throw new AppError(
        502,
        "OPENAI_REVIEW_INVALID_OUTPUT",
        "The academic review did not include exactly one decision for every candidate.",
        { expected: questions.length, received: reviews.length },
      );
    }

    const sumMetric = (selector: (metrics: ProviderCallMetrics) => number) =>
      batchResults.reduce((total, result) => {
        return total + (result.metrics ? selector(result.metrics) : 0);
      }, 0);
    const usage = {
      promptTokens: batchResults.reduce(
        (total, result) => total + (result.metrics?.usage?.promptTokens ?? 0),
        0,
      ),
      completionTokens: batchResults.reduce(
        (total, result) =>
          total + (result.metrics?.usage?.completionTokens ?? 0),
        0,
      ),
      totalTokens: batchResults.reduce(
        (total, result) => total + (result.metrics?.usage?.totalTokens ?? 0),
        0,
      ),
      cachedPromptTokens: batchResults.reduce(
        (total, result) =>
          total + (result.metrics?.usage?.cachedPromptTokens ?? 0),
        0,
      ),
    };

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        subject: request.subject,
        candidateCount: questions.length,
        batchCount: batches.length,
        acceptedCount: reviews.filter((review) => review.accepted).length,
        rejectedCount: reviews.filter((review) => !review.accepted).length,
        latencyMs: Date.now() - startedAt,
      },
      "Independent academic quality review completed.",
    );

    return {
      provider: "openai",
      model: env.OPENAI_REVIEW_MODEL,
      reviews,
      rawResponse: {
        batches: batchResults.map((result) => result.rawResponse),
      },
      metrics: {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        callCount: batchResults.length,
        latencyMs: Date.now() - startedAt,
        promptCharacters: sumMetric((metrics) => metrics.promptCharacters),
        responseCharacters: sumMetric((metrics) => metrics.responseCharacters),
        usage,
      },
    };
  }

  private async reviewQuestionBatch(
    request: GenerationProviderRequest,
    indexedQuestions: Array<{
      candidateIndex: number;
      question: ValidatedQuestionPayload;
    }>,
    batchNumber: number,
    batchCount: number,
  ): Promise<QuestionQualityReviewResult> {
    const reviewPayload = indexedQuestions.map(
      ({ candidateIndex, question }) => ({
        candidateIndex,
        difficulty: question.difficulty,
        questionText: question.text,
        options: question.options,
        suppliedCorrectOption: question.correctOption,
        conceptTested: question.conceptTested,
        learningOutcome: question.learningOutcome,
        commonMistake: question.commonMistake,
        recommendedRemedialAction: question.recommendedRemedialAction,
        solutionOutline: question.metadata.solutionOutline,
        difficultyRationale: question.metadata.difficultyRationale,
      }),
    );
    const candidatesByIndex = new Map(
      indexedQuestions.map(({ candidateIndex, question }) => [
        candidateIndex,
        question,
      ]),
    );
    const prompt = [
      "Act as an independent senior examination quality reviewer. Do not trust the supplied answer key.",
      `Subject: ${request.subject}`,
      `Class/Grade: ${request.classLevel}`,
      `Chapter: ${request.chapter}`,
      `Subtopic: ${request.subTopic}`,
      `Target exams: ${request.targetExams.join(", ")}`,
      `Grounded concepts: ${request.syllabusContext.coreConcepts.join("; ")}`,
      `Difficulty guidance: ${
        Object.entries(request.syllabusContext.difficultyGuidance ?? {})
          .map(
            ([difficulty, guidance]) => `${difficulty}: ${guidance.join(" ")}`,
          )
          .join(" | ") ||
        "Use difficulty relative to this class, subtopic, and target exam."
      }`,
      "Privately solve each candidate from first principles and review it independently. For calculations, explicitly recompute the decisive relation before deciding; never infer correctness from the supplied correctOption.",
      "For dimensional-analysis or unit-conversion candidates, substitute base dimensions for every quantity and simplify the complete numerator and denominator before comparing the result with all four options. Reject if no option or more than one option matches.",
      "Judge difficulty relative to this selected class, narrow syllabus slice, and target exam. The supplied syllabus-specific difficulty guidance is the authoritative grading rubric for this product. Mark difficultyAligned true when the candidate genuinely satisfies one listed construction for its assigned level; do not downgrade a valid two-stage or multiple-constraint Hard construction merely because its individual algebraic operations are familiar. Still reject any Hard candidate that is actually only a routine one-step homogeneity check, direct fact, or unsupported rationale.",
      "Accept a candidate only when it genuinely tests the selected syllabus, is academically correct, has exactly one defensible option matching correctOption, has plausible distractors, matches its claimed difficulty, and has accurate pedagogical metadata.",
      "Reject vague, underspecified, trivial-for-level, off-topic, internally inconsistent, or numerically incorrect questions. Reject unit-conversion questions if the stated conversion direction or factor is ambiguous.",
      "For each candidate return the independently derived correct option, or null if no option or multiple options are defensible. The verificationSummary must state only the decisive equation, fact, or result in one short sentence.",
      'Return JSON only in this exact shape: {"reviews":[{"candidateIndex":1,"accepted":true,"independentCorrectOption":"A","syllabusAligned":true,"unambiguous":true,"difficultyAligned":true,"metadataAligned":true,"verificationSummary":"concise decisive result","issues":[]}]}. independentCorrectOption must be A, B, C, D, or null. Return one review for every candidate in the same order. Issues must be concise conclusions, not hidden chain-of-thought.',
      `Candidates: ${JSON.stringify(reviewPayload)}`,
    ].join("\n\n");
    const startedAt = Date.now();

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        subject: request.subject,
        candidateCount: indexedQuestions.length,
        batchNumber,
        batchCount,
      },
      "Dispatching focused academic review batch.",
    );

    const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_REVIEW_MODEL,
        ...modelControls(
          env.OPENAI_REVIEW_MODEL,
          env.OPENAI_REVIEW_REASONING_EFFORT,
          0,
        ),
        response_format: REVIEW_RESPONSE_FORMAT,
        messages: [
          {
            role: "system",
            content:
              "You are a strict independent academic examiner and answer-key auditor. Review every candidate, solve it independently, and return JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        502,
        "OPENAI_REVIEW_FAILED",
        "The OpenAI academic quality review request failed.",
        { status: response.status, body },
      );
    }

    const parsed = (await response.json()) as ChatCompletionResponse;
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError(
        502,
        "OPENAI_REVIEW_EMPTY_RESPONSE",
        "The OpenAI academic review did not contain any content.",
      );
    }

    let rawReview: QualityReviewResponse;
    try {
      rawReview = JSON.parse(content) as QualityReviewResponse;
    } catch {
      throw new AppError(
        502,
        "OPENAI_REVIEW_INVALID_JSON",
        "The OpenAI academic review was not valid JSON.",
      );
    }

    const reviews = (rawReview.reviews ?? []).map((review) => {
      const candidateIndex = Number(review.candidateIndex);
      const candidate = candidatesByIndex.get(candidateIndex);
      const independentCorrectOption = ["A", "B", "C", "D"].includes(
        String(review.independentCorrectOption).toUpperCase(),
      )
        ? (String(review.independentCorrectOption).toUpperCase() as
            "A" | "B" | "C" | "D")
        : null;
      const syllabusAligned = review.syllabusAligned === true;
      const unambiguous = review.unambiguous === true;
      const difficultyAligned = review.difficultyAligned === true;
      const metadataAligned = review.metadataAligned === true;
      const verificationSummary =
        typeof review.verificationSummary === "string"
          ? review.verificationSummary.trim()
          : "";
      const issues = Array.isArray(review.issues)
        ? review.issues.map((issue) => String(issue)).filter(Boolean)
        : ["The academic reviewer did not return a valid issue list."];
      const answerMatches =
        independentCorrectOption === candidate?.correctOption;
      const accepted =
        review.accepted === true &&
        answerMatches &&
        syllabusAligned &&
        unambiguous &&
        difficultyAligned &&
        metadataAligned &&
        verificationSummary.length >= 8;

      if (!answerMatches) {
        issues.push(
          independentCorrectOption
            ? `Independent solution gives option ${independentCorrectOption}, not ${candidate?.correctOption ?? "the supplied answer"}.`
            : "Independent review found no single defensible correct option.",
        );
      }

      return {
        candidateIndex,
        accepted,
        independentCorrectOption,
        syllabusAligned,
        unambiguous,
        difficultyAligned,
        metadataAligned,
        verificationSummary,
        issues: Array.from(new Set(issues)),
      };
    });
    const expectedIndexes = new Set(
      indexedQuestions.map(({ candidateIndex }) => candidateIndex),
    );
    const validIndexes = new Set(
      reviews.map((review) => review.candidateIndex),
    );
    if (
      reviews.length !== indexedQuestions.length ||
      validIndexes.size !== indexedQuestions.length ||
      reviews.some((review) => !expectedIndexes.has(review.candidateIndex))
    ) {
      throw new AppError(
        502,
        "OPENAI_REVIEW_INVALID_OUTPUT",
        "The academic review did not include exactly one decision for every candidate.",
        {
          expected: indexedQuestions.length,
          received: reviews.length,
          batchNumber,
        },
      );
    }

    logger.info(
      {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        subject: request.subject,
        candidateCount: indexedQuestions.length,
        batchNumber,
        batchCount,
        acceptedCount: reviews.filter((review) => review.accepted).length,
        rejectedCount: reviews.filter((review) => !review.accepted).length,
        latencyMs: Date.now() - startedAt,
      },
      "Focused academic review batch completed.",
    );

    return {
      provider: "openai",
      model: env.OPENAI_REVIEW_MODEL,
      reviews,
      rawResponse: rawReview as Record<string, unknown>,
      metrics: {
        provider: "openai",
        model: env.OPENAI_REVIEW_MODEL,
        latencyMs: Date.now() - startedAt,
        promptCharacters: prompt.length,
        responseCharacters: content.length,
        usage: {
          promptTokens: parsed.usage?.prompt_tokens ?? 0,
          completionTokens: parsed.usage?.completion_tokens ?? 0,
          totalTokens: parsed.usage?.total_tokens ?? 0,
          cachedPromptTokens:
            parsed.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        },
      },
    };
  }

  async embedTexts(texts: string[]): Promise<EmbeddingCallResult> {
    if (!env.OPENAI_API_KEY) {
      throw new AppError(
        503,
        "OPENAI_NOT_CONFIGURED",
        "OPENAI_API_KEY is required to compute semantic similarity.",
      );
    }

    const startedAt = Date.now();
    const response = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        502,
        "OPENAI_EMBEDDING_FAILED",
        "The OpenAI embedding request failed.",
        { status: response.status, body },
      );
    }

    const parsed = (await response.json()) as EmbeddingResponse;
    return {
      provider: "openai",
      model: env.OPENAI_EMBEDDING_MODEL,
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
