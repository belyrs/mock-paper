export const APP_EXAMS = ["JEE", "NEET"] as const;
export const TARGET_EXAMS = ["JEE_MAIN", "NEET", "KCET", "CBSE"] as const;
export const CLASS_LEVELS = ["Class 11", "Class 12"] as const;
export const PAPER_MODES = ["full-paper", "individual"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const QUESTION_TYPES = ["MCQ"] as const;
export const PAPER_STATUSES = ["active", "deleted"] as const;
export const GENERATION_STATUSES = ["completed", "failed"] as const;
export const USER_ROLES = ["user", "admin"] as const;
export const HISTORICAL_ANALYSIS_MODES = [
  "imported_dataset",
  "model_knowledge_fallback",
  "mixed",
] as const;

export type AppExam = (typeof APP_EXAMS)[number];
export type TargetExam = (typeof TARGET_EXAMS)[number];
export type ClassLevel = (typeof CLASS_LEVELS)[number];
export type PaperMode = (typeof PAPER_MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type PaperStatus = (typeof PAPER_STATUSES)[number];
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type HistoricalAnalysisMode = (typeof HISTORICAL_ANALYSIS_MODES)[number];

export interface DifficultyMix {
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface SubjectConfiguration {
  subject: string;
  chapter: string;
  subTopic: string;
  numberOfQuestions: number;
  mix: DifficultyMix;
}

export interface ExamRelevanceMap {
  JEE_MAIN?: string;
  NEET?: string;
  KCET?: string;
  CBSE?: string;
}

export interface HistoricalAnalysisSummary {
  mode: HistoricalAnalysisMode;
  totalRelevantQuestions: number;
  yearsCovered: number[];
  trendSummary: string;
  recurringConcepts: string[];
  difficultyNotes: string[];
  sourceDetails: string[];
}
