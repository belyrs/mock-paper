import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { QuestionGenerationProvider } from "./types";
import { MockQuestionGenerationProvider } from "./mock.provider";
import { OpenAiQuestionGenerationProvider } from "./openai.provider";
import { ResilientQuestionGenerationProvider } from "./resilient.provider";

export function createQuestionGenerationProvider(): QuestionGenerationProvider {
  if (env.QUESTION_PROVIDER === "mock") {
    logger.info("Question generation provider resolved to the deterministic syllabus fallback.");
    return new MockQuestionGenerationProvider();
  }

  if (!env.OPENAI_API_KEY?.trim()) {
    logger.warn(
      {
        configuredProvider: env.QUESTION_PROVIDER,
        fallbackProvider: "mock",
      },
      "OPENAI_API_KEY is missing. Falling back to the deterministic syllabus-based generator until a working OpenAI API key is configured.",
    );
    return new MockQuestionGenerationProvider();
  }

  logger.info(
    {
      provider: "openai",
      fallbackProvider: "mock",
      model: env.OPENAI_MODEL,
      baseUrl: env.OPENAI_BASE_URL,
    },
    "Question generation provider resolved to OpenAI with deterministic syllabus fallback.",
  );
  return new ResilientQuestionGenerationProvider(
    new OpenAiQuestionGenerationProvider(),
    new MockQuestionGenerationProvider(),
  );
}
