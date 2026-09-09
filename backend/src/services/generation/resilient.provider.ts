import { logger } from "../../config/logger";
import { AppError } from "../../errors/app-error";
import type {
  EmbeddingCallResult,
  GenerationProviderRequest,
  GenerationProviderResult,
  QuestionQualityReviewResult,
  QuestionGenerationProvider,
  ValidatedQuestionPayload,
} from "./types";

function isFallbackEligible(error: unknown) {
  if (!(error instanceof AppError)) {
    return false;
  }

  if (error.code === "OPENAI_NOT_CONFIGURED") {
    return true;
  }

  if (!error.code.startsWith("OPENAI_")) {
    return false;
  }

  const status = Number(
    (error.details as { status?: unknown } | undefined)?.status ?? 0,
  );
  return (
    [401, 402, 408, 409, 422, 429, 500, 502, 503, 504].includes(status) ||
    status === 0
  );
}

export class ResilientQuestionGenerationProvider implements QuestionGenerationProvider {
  constructor(
    private readonly primaryProvider: QuestionGenerationProvider,
    private readonly fallbackProvider: QuestionGenerationProvider,
  ) {}

  async generate(
    request: GenerationProviderRequest,
  ): Promise<GenerationProviderResult> {
    try {
      return await this.primaryProvider.generate(request);
    } catch (error) {
      if (!isFallbackEligible(error)) {
        throw error;
      }

      logger.warn(
        {
          subject: request.subject,
          chapter: request.chapter,
          subTopic: request.subTopic,
          err: error,
          fallbackProvider: this.fallbackProvider.constructor.name,
        },
        "Primary generation provider failed. Falling back to the deterministic syllabus-based generator.",
      );

      const fallbackResult = await this.fallbackProvider.generate(request);

      return {
        ...fallbackResult,
        rawResponse: {
          ...fallbackResult.rawResponse,
          fallback: {
            attemptedProvider: "openai",
            fallbackProvider: fallbackResult.provider,
            reason:
              error instanceof Error
                ? error.message
                : "Unknown provider failure",
            errorCode:
              error instanceof AppError ? error.code : "UNKNOWN_PROVIDER_ERROR",
            errorDetails:
              error instanceof AppError ? (error.details ?? null) : null,
          },
        },
      };
    }
  }

  async embedTexts(texts: string[]): Promise<EmbeddingCallResult> {
    if (this.primaryProvider.embedTexts) {
      try {
        return await this.primaryProvider.embedTexts(texts);
      } catch (error) {
        logger.warn(
          {
            textCount: texts.length,
            err: error,
            fallbackProvider: this.fallbackProvider.constructor.name,
          },
          "Primary embedding provider failed. Falling back to the secondary embedding provider.",
        );
      }
    }

    if (this.fallbackProvider.embedTexts) {
      return this.fallbackProvider.embedTexts(texts);
    }

    throw new Error(
      "No embedding provider is available for semantic duplicate detection.",
    );
  }

  async reviewQuestions(
    request: GenerationProviderRequest,
    questions: ValidatedQuestionPayload[],
  ): Promise<QuestionQualityReviewResult> {
    if (!this.primaryProvider.reviewQuestions) {
      throw new AppError(
        503,
        "ACADEMIC_REVIEW_UNAVAILABLE",
        "The configured generation provider does not support independent academic review.",
      );
    }

    return this.primaryProvider.reviewQuestions(request, questions);
  }
}
