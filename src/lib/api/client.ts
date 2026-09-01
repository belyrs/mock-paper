import type {
  HistoricalStatus,
  Paper,
  QuestionUpdateInput,
  SubjectConfig,
  User,
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(
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
    return request<{ message: string; reset: { delivered: boolean; previewUrl: string | null; previewToken: string | null } }>(
      "/auth/password-reset/request",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
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
  updateQuestion(paperId: string, questionId: string, input: QuestionUpdateInput) {
    return request<{ paper: Paper }>(`/papers/${paperId}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  regenerateQuestion(paperId: string, questionId: string) {
    return request<{ paper: Paper }>(`/papers/${paperId}/questions/${questionId}/regenerate`, {
      method: "POST",
    });
  },
  historicalStatus() {
    return request<HistoricalStatus>("/historical-papers/status");
  },
};
