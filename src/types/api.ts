export type ClassLevel = "Class 11" | "Class 12";
export type ExamId = "JEE" | "NEET";
export type Mode = "full-paper" | "individual";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type TargetExam = "JEE_MAIN" | "NEET" | "KCET" | "CBSE";
export type UserRole = "user" | "admin";

export interface DifficultyMix {
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface SubjectConfig {
  chapter: string;
  subTopic: string;
  numberOfQuestions: number;
  mix: DifficultyMix;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  paperId: string;
  position: number;
  subject: string;
  classLevel: ClassLevel;
  chapter: string;
  subTopic: string;
  targetExams: TargetExam[];
  difficulty: Difficulty;
  questionType: "MCQ";
  text: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  correctIndex: number;
  conceptTested: string;
  commonMistake: string;
  recommendedRemedialAction: string;
  learningOutcome: string;
  bloomsTaxonomyLevel: string;
  examRelevance: Partial<Record<TargetExam, string>>;
  sourceReference: string | null;
  generationProvider: string;
  generationModel: string;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paper {
  id: string;
  userId: string;
  title: string;
  exam: ExamId;
  classLevel: ClassLevel;
  mode: Mode;
  targetExams: TargetExam[];
  subjectConfigurations: Array<SubjectConfig & { subject: string }>;
  questionCount: number;
  status: "active" | "deleted";
  generationProvider: string;
  generationModel: string;
  promptVersion: string;
  historicalAnalysisMode: "imported_dataset" | "model_knowledge_fallback" | "mixed";
  historicalAnalysisSummary: {
    mode: "imported_dataset" | "model_knowledge_fallback" | "mixed";
    totalRelevantQuestions: number;
    yearsCovered: number[];
    trendSummary: string;
    recurringConcepts: string[];
    difficultyNotes: string[];
    sourceDetails: string[];
  };
  validationSummary: Record<string, unknown>;
  notes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

export interface HistoricalStatus {
  totalImportedQuestions: number;
  isHistoricalDatasetAvailable: boolean;
}

export interface QuestionUpdateInput {
  text: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  difficulty?: Difficulty;
  conceptTested: string;
  commonMistake: string;
  recommendedRemedialAction: string;
  learningOutcome: string;
  bloomsTaxonomyLevel: string;
  sourceReference?: string | null;
  examRelevance: Partial<Record<TargetExam, string>>;
}
