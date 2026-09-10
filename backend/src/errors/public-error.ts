import type { AppError } from "./app-error";

const PREPARATION_ERROR_CODES = new Set([
  "ACADEMIC_REVIEW_UNAVAILABLE",
  "ACADEMIC_VALIDATION_FAILED",
  "DUPLICATE_IN_GENERATED_BATCH",
  "INVALID_DIFFICULTY_DISTRIBUTION",
  "INVALID_GENERATION_COUNT",
  "INVALID_GENERATION_OUTPUT",
  "MISSING_GENERATED_QUESTION",
  "QUESTION_GENERATION_FAILED",
  "QUESTION_GENERATION_UNIQUE_EXHAUSTED",
  "QUESTION_REGEN_FAILED",
]);

function isPreparationError(code: string) {
  return (
    code.startsWith("OPENAI_") ||
    code.startsWith("MOCK_PROVIDER_") ||
    PREPARATION_ERROR_CODES.has(code)
  );
}

export interface PublicErrorPayload {
  code: string;
  message: string;
  details: unknown;
}

export function toPublicError(error: AppError): PublicErrorPayload {
  if (error.code === "OPENAI_REQUEST_TIMEOUT") {
    return {
      code: "QUESTION_PREPARATION_TIMEOUT",
      message:
        "Question paper preparation is taking longer than expected. Please try again.",
      details: null,
    };
  }

  if (isPreparationError(error.code)) {
    return {
      code: "QUESTION_PREPARATION_FAILED",
      message: "We couldn't prepare the question paper. Please try again.",
      details: null,
    };
  }

  if (error.statusCode >= 500) {
    return {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong while processing your request.",
      details: null,
    };
  }

  return {
    code: error.code,
    message: error.message,
    details: error.details ?? null,
  };
}
