import { AppError } from "../../errors/app-error";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { buildQuestionPrompt } from "./prompt-builder";
import { PROMPT_VERSION } from "./prompt-template";
import type {
  EmbeddingCallResult,
  GenerationProviderRequest,
  GenerationProviderResult,
  QuestionGenerationProvider,
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

export class OpenAiQuestionGenerationProvider implements QuestionGenerationProvider {
  async generate(request: GenerationProviderRequest): Promise<GenerationProviderResult> {
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
      },
      "Dispatching OpenAI question generation request.",
    );

    const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: env.QUESTION_GENERATION_TEMPERATURE,
        response_format: { type: "json_object" },
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
      },
      "Received OpenAI question generation response.",
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
      questions: (json.questions as GenerationProviderResult["questions"]) ?? [],
      historicalAnalysisMode:
        (json.historicalAnalysisMode as GenerationProviderResult["historicalAnalysisMode"]) ??
        request.historicalAnalysis.mode,
      historicalAnalysisSummary:
        (json.historicalAnalysisSummary as string) ??
        request.historicalAnalysis.trendSummary,
      metrics: {
        provider: "openai",
        model: env.OPENAI_MODEL,
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
