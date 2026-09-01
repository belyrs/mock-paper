import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  EXAMS,
  emptySubjectConfig,
  type ClassLevel,
  type ExamId,
  type Mode,
  type Paper,
  type SubjectConfig,
} from "@/lib/mock-generator";
import type { QuestionUpdateInput, User } from "@/types/api";

interface AppState {
  hydrated: boolean;
  user: User | null;
  sessionLoading: boolean;
  historyLoading: boolean;
  currentPaperLoading: boolean;
  userError: string | null;
  historyError: string | null;
  history: Paper[];
  currentPaper: Paper | null;
  currentPaperId: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ previewUrl: string | null }>;
  confirmPasswordReset: (token: string, password: string) => Promise<void>;

  classLevel: ClassLevel | null;
  exam: ExamId | null;
  mode: Mode | null;
  fullPaperConfig: Record<string, SubjectConfig>;
  individualSubject: string;
  individualConfig: SubjectConfig;

  setClassLevel: (classLevel: ClassLevel) => void;
  setExam: (exam: ExamId) => void;
  setMode: (mode: Mode) => void;
  setFullPaperConfig: (subject: string, patch: Partial<SubjectConfig>) => void;
  setIndividualSubject: (subject: string) => void;
  setIndividualConfig: (patch: Partial<SubjectConfig>) => void;
  setCurrentPaperId: (paperId: string | null) => void;

  generatePaper: () => Promise<Paper>;
  renamePaper: (paperId: string, title: string) => Promise<void>;
  regeneratePaper: (paperId: string) => Promise<Paper>;
  regenerateQuestion: (paperId: string, questionId: string) => Promise<Paper>;
  updateQuestion: (paperId: string, questionId: string, input: QuestionUpdateInput) => Promise<Paper>;
  resetFlow: () => void;
}

interface PersistedDraftState {
  classLevel: ClassLevel | null;
  exam: ExamId | null;
  mode: Mode | null;
  fullPaperConfig: Record<string, SubjectConfig>;
  individualSubject: string;
  individualConfig: SubjectConfig;
  currentPaperId: string | null;
}

const STORAGE_KEY = "mockpaper.state.v2";

const initialDraftState: PersistedDraftState = {
  classLevel: null,
  exam: null,
  mode: null,
  fullPaperConfig: {},
  individualSubject: "",
  individualConfig: emptySubjectConfig(),
  currentPaperId: null,
};

const AppStateContext = createContext<AppState | null>(null);

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [draftState, setDraftState] = useState<PersistedDraftState>(initialDraftState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setDraftState({ ...initialDraftState, ...(JSON.parse(raw) as PersistedDraftState) });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftState));
    } catch {
      /* ignore */
    }
  }, [draftState, hydrated]);

  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await apiClient.me()).user,
    retry: false,
    enabled: hydrated,
    staleTime: 5 * 60 * 1000,
  });

  const papersQuery = useQuery({
    queryKey: ["papers"],
    queryFn: async () => (await apiClient.listPapers()).papers,
    enabled: hydrated && !!userQuery.data,
    staleTime: 30 * 1000,
  });

  const currentPaperQuery = useQuery({
    queryKey: ["papers", draftState.currentPaperId],
    queryFn: async () => {
      if (!draftState.currentPaperId) return null;
      return (await apiClient.getPaper(draftState.currentPaperId)).paper;
    },
    enabled: hydrated && !!userQuery.data && !!draftState.currentPaperId,
    initialData: () =>
      papersQuery.data?.find((paper) => paper.id === draftState.currentPaperId) ?? null,
  });

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      user: userQuery.data ?? null,
      sessionLoading: userQuery.isLoading || (userQuery.isFetching && !userQuery.data),
      historyLoading: papersQuery.isLoading,
      currentPaperLoading:
        !!draftState.currentPaperId &&
        (currentPaperQuery.isLoading ||
          (currentPaperQuery.isFetching && !currentPaperQuery.data)),
      userError: userQuery.error ? normalizeError(userQuery.error) : null,
      historyError: papersQuery.error ? normalizeError(papersQuery.error) : null,
      history: papersQuery.data ?? [],
      currentPaper: currentPaperQuery.data ?? null,
      currentPaperId: draftState.currentPaperId,

      login: async (email, password) => {
        const response = await apiClient.login({ email, password });
        setDraftState((state) => ({ ...state, currentPaperId: null }));
        queryClient.setQueryData(["auth", "me"], response.user);
        queryClient.removeQueries({ queryKey: ["papers"] });
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      signup: async (name, email, password) => {
        const response = await apiClient.register({ name, email, password });
        setDraftState((state) => ({ ...state, currentPaperId: null }));
        queryClient.setQueryData(["auth", "me"], response.user);
        queryClient.removeQueries({ queryKey: ["papers"] });
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      logout: async () => {
        await apiClient.logout();
        setDraftState((state) => ({ ...state, currentPaperId: null }));
        queryClient.setQueryData(["auth", "me"], null);
        await queryClient.resetQueries({ queryKey: ["auth", "me"] });
        await queryClient.removeQueries({ queryKey: ["papers"] });
      },
      requestPasswordReset: async (email) => {
        const response = await apiClient.requestPasswordReset({ email });
        return { previewUrl: response.reset.previewUrl };
      },
      confirmPasswordReset: async (token, password) => {
        await apiClient.confirmPasswordReset({ token, password });
      },

      classLevel: draftState.classLevel,
      exam: draftState.exam,
      mode: draftState.mode,
      fullPaperConfig: draftState.fullPaperConfig,
      individualSubject: draftState.individualSubject,
      individualConfig: draftState.individualConfig,

      setClassLevel: (classLevel) => setDraftState((state) => ({ ...state, classLevel })),
      setExam: (exam) =>
        setDraftState((state) => {
          const subjects = EXAMS[exam].subjects;
          const nextConfig: Record<string, SubjectConfig> = {};
          for (const subject of subjects) {
            nextConfig[subject] = state.fullPaperConfig[subject] ?? emptySubjectConfig();
          }

          return {
            ...state,
            exam,
            fullPaperConfig: nextConfig,
            individualSubject: subjects.includes(state.individualSubject) ? state.individualSubject : "",
          };
        }),
      setMode: (mode) => setDraftState((state) => ({ ...state, mode })),
      setFullPaperConfig: (subject, patch) =>
        setDraftState((state) => ({
          ...state,
          fullPaperConfig: {
            ...state.fullPaperConfig,
            [subject]: {
              ...(state.fullPaperConfig[subject] ?? emptySubjectConfig()),
              ...patch,
            },
          },
        })),
      setIndividualSubject: (individualSubject) =>
        setDraftState((state) => ({ ...state, individualSubject })),
      setIndividualConfig: (patch) =>
        setDraftState((state) => ({
          ...state,
          individualConfig: { ...state.individualConfig, ...patch },
        })),
      setCurrentPaperId: (currentPaperId) =>
        setDraftState((state) => ({ ...state, currentPaperId })),

      generatePaper: async () => {
        if (!draftState.exam || !draftState.classLevel || !draftState.mode) {
          throw new Error("Please complete the generation setup first.");
        }

        const subjects =
          draftState.mode === "full-paper"
            ? EXAMS[draftState.exam].subjects.map((subject) => ({
                subject,
                ...(draftState.fullPaperConfig[subject] ?? emptySubjectConfig()),
              }))
            : [
                {
                  subject: draftState.individualSubject,
                  ...draftState.individualConfig,
                },
              ];

        const paper = (
          await apiClient.generatePaper({
            exam: draftState.exam,
            classLevel: draftState.classLevel,
            mode: draftState.mode,
            subjects,
          })
        ).paper;

        setDraftState((state) => ({ ...state, currentPaperId: paper.id }));
        queryClient.setQueryData(["papers"], (existing: Paper[] | undefined) =>
          existing ? [paper, ...existing.filter((item) => item.id !== paper.id)] : [paper],
        );
        queryClient.setQueryData(["papers", paper.id], paper);
        return paper;
      },
      renamePaper: async (paperId, title) => {
        const paper = (await apiClient.renamePaper(paperId, title)).paper;
        queryClient.setQueryData(["papers", paper.id], paper);
        queryClient.setQueryData(["papers"], (existing: Paper[] | undefined) =>
          existing?.map((item) => (item.id === paper.id ? paper : item)) ?? [paper],
        );
      },
      regeneratePaper: async (paperId) => {
        const paper = (await apiClient.regeneratePaper(paperId)).paper;
        setDraftState((state) => ({ ...state, currentPaperId: paper.id }));
        queryClient.setQueryData(["papers", paper.id], paper);
        queryClient.setQueryData(["papers"], (existing: Paper[] | undefined) =>
          existing ? [paper, ...existing.filter((item) => item.id !== paper.id)] : [paper],
        );
        return paper;
      },
      regenerateQuestion: async (paperId, questionId) => {
        const paper = (await apiClient.regenerateQuestion(paperId, questionId)).paper;
        queryClient.setQueryData(["papers", paper.id], paper);
        queryClient.setQueryData(["papers"], (existing: Paper[] | undefined) =>
          existing?.map((item) => (item.id === paper.id ? paper : item)) ?? [paper],
        );
        return paper;
      },
      updateQuestion: async (paperId, questionId, input) => {
        const paper = (await apiClient.updateQuestion(paperId, questionId, input)).paper;
        queryClient.setQueryData(["papers", paper.id], paper);
        queryClient.setQueryData(["papers"], (existing: Paper[] | undefined) =>
          existing?.map((item) => (item.id === paper.id ? paper : item)) ?? [paper],
        );
        return paper;
      },
      resetFlow: () =>
        setDraftState((state) => ({
          ...state,
          classLevel: null,
          exam: null,
          mode: null,
          fullPaperConfig: {},
          individualSubject: "",
          individualConfig: emptySubjectConfig(),
          currentPaperId: null,
        })),
    }),
    [
      currentPaperQuery.data,
      currentPaperQuery.isFetching,
      currentPaperQuery.isLoading,
      draftState,
      hydrated,
      papersQuery.data,
      papersQuery.error,
      papersQuery.isLoading,
      queryClient,
      userQuery.data,
      userQuery.error,
      userQuery.isLoading,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used within AppStateProvider");
  return value;
}
