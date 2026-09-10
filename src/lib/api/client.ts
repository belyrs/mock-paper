import type {
  HistoricalStatus,
  Paper,
  QuestionUpdateInput,
  SubjectConfig,
  User,
} from "@/types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const INTERNAL_PREPARATION_CODE =
  /^(?:OPENAI_|MOCK_PROVIDER_|ACADEMIC_|INVALID_GENERATION_|DUPLICATE_IN_GENERATED_BATCH|QUESTION_GENERATION_|QUESTION_REGEN_FAILED)/;
const INTERNAL_TECHNOLOGY_MESSAGE =
  /\b(?:AI|artificial intelligence|OpenAI|Azure OpenAI|ChatGPT|Codex|GPT(?:[- .]?[A-Za-z0-9.]+)?|LLMs?|language model|Anthropic|Claude|Gemini|Mistral|Cohere|Perplexity|Llama|DeepSeek|Amazon Bedrock|AWS Bedrock|Groq|Grok|xAI|Hugging Face|Together AI|Replicate)\b/i;
const INTERNAL_PREPARATION_MESSAGE =
  /\b(?:provider|prompt|completion|embedding|API quota|token limit|rate limit|model (?:output|response|returned|generated))\b/i;

function safeApiError(
  path: string,
  status: number,
  code: string,
  message: string,
  details: unknown,
) {
  if (
    code === "OPENAI_REQUEST_TIMEOUT" ||
    code === "QUESTION_PREPARATION_TIMEOUT"
  ) {
    return new ApiError(
      status,
      "QUESTION_PREPARATION_TIMEOUT",
      "Question paper preparation is taking longer than expected. Please try again.",
    );
  }

  if (
    INTERNAL_PREPARATION_CODE.test(code) ||
    INTERNAL_TECHNOLOGY_MESSAGE.test(message) ||
    (path.startsWith("/papers") &&
      (status >= 500 || INTERNAL_PREPARATION_MESSAGE.test(message)))
  ) {
    return new ApiError(
      status,
      "QUESTION_PREPARATION_FAILED",
      "We couldn't prepare the question paper. Please try again.",
    );
  }

  return new ApiError(status, code, message, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "We couldn't reach the question-paper service. Please check your connection and try again.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    T | ApiErrorPayload | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw safeApiError(
      path,
      response.status,
      errorPayload?.error?.code ?? "API_ERROR",
      errorPayload?.error?.message ?? "Request failed.",
      errorPayload?.error?.details,
    );
  }

  return payload as T;
}

export const apiClient = {
  register(input: { name: string; email: string; password: string }) {
    return request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(input: { email: string; password: string }) {
    return request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  me() {
    return request<{ user: User }>("/auth/me");
  },
  logout() {
    return request<void>("/auth/logout", { method: "POST" });
  },
  requestPasswordReset(input: { email: string }) {
    return request<{
      message: string;
      reset: {
        delivered: boolean;
        previewUrl: string | null;
        previewToken: string | null;
      };
    }>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  confirmPasswordReset(input: { token: string; password: string }) {
    return request<void>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  listPapers() {
    return request<{ papers: Paper[] }>("/papers");
  },
  getPaper(paperId: string) {
    return request<{ paper: Paper }>(`/papers/${paperId}`);
  },
  generatePaper(input: {
    title?: string;
    exam: "JEE" | "NEET";
    classLevel: "Class 11" | "Class 12";
    mode: "full-paper" | "individual";
    targetExams?: Array<"JEE_MAIN" | "NEET" | "KCET" | "CBSE">;
    subjects: Array<SubjectConfig & { subject: string }>;
  }) {
    return request<{ paper: Paper }>("/papers/generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  renamePaper(paperId: string, title: string) {
    return request<{ paper: Paper }>(`/papers/${paperId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  deletePaper(paperId: string) {
    return request<void>(`/papers/${paperId}`, {
      method: "DELETE",
    });
  },
  regeneratePaper(paperId: string) {
    return request<{ paper: Paper }>(`/papers/${paperId}/regenerate`, {
      method: "POST",
    });
  },
  updateQuestion(
    paperId: string,
    questionId: string,
    input: QuestionUpdateInput,
  ) {
    return request<{ paper: Paper }>(
      `/papers/${paperId}/questions/${questionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },
  regenerateQuestion(paperId: string, questionId: string) {
    return request<{ paper: Paper }>(
      `/papers/${paperId}/questions/${questionId}/regenerate`,
      {
        method: "POST",
      },
    );
  },
  historicalStatus() {
    return request<HistoricalStatus>("/historical-papers/status");
  },
};
