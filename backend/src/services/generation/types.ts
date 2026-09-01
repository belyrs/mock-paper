import type {
  Difficulty,
  DifficultyMix,
  ExamRelevanceMap,
  HistoricalAnalysisSummary,
  SubjectConfiguration,
  TargetExam,
  ClassLevel,
} from "../../constants/domain";

export interface GeneratedQuestionCandidate {
  questionNumber: number;
  difficulty: Difficulty;
  questionText: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  conceptTested: string;
  commonMistake: string;
  recommendedRemedialAction: string;
  learningOutcome: string;
  bloomsTaxonomyLevel: string;
  examRelevance: ExamRelevanceMap;
  sourceReference?: string | null;
}

export interface GenerationSyllabusContext {
  entryKey: string | null;
  canonicalMatch: boolean;
  matchScore: number;
  summary: string;
  coreConcepts: string[];
  learningOutcomes: string[];
  commonMisconceptions: string[];
  questionPatterns: string[];
  validationKeywords: string[];
}

export interface GenerationPlanSlot {
  slotNumber: number;
  difficulty: Difficulty;
  concept: string;
  pattern: string;
  learningOutcome: string;
}

export interface ProviderUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens: number;
}

export interface ProviderCallMetrics {
  provider: string;
  model: string;
  latencyMs: number;
  promptCharacters: number;
  responseCharacters: number;
  usage?: ProviderUsageMetrics;
}

export interface EmbeddingUsageMetrics {
  promptTokens: number;
  totalTokens: number;
}

export interface EmbeddingCallResult {
  provider: string;
  model: string;
  latencyMs: number;
  inputCount: number;
  embeddings: number[][];
  usage?: EmbeddingUsageMetrics;
}

export interface GenerationProviderRequest {
  subject: string;
  classLevel: ClassLevel;
  chapter: string;
  subTopic: string;
  targetExams: TargetExam[];
  questionCount: number;
  difficultyMix: DifficultyMix;
  difficultyCounts?: DifficultyMix;
  historicalAnalysis: HistoricalAnalysisSummary;
  previousQuestions: string[];
  syllabusContext: GenerationSyllabusContext;
  generationPlan: GenerationPlanSlot[];
  retryContext?: {
    attempt: number;
    acceptedQuestionTexts: string[];
    rejectedQuestionTexts: string[];
    rejectionReasons: string[];
  };
}

export interface GenerationProviderResult {
  rawPrompt: string;
  rawResponse: Record<string, unknown>;
  provider: string;
  model: string;
  questions: GeneratedQuestionCandidate[];
  historicalAnalysisMode: HistoricalAnalysisSummary["mode"];
  historicalAnalysisSummary: string;
  metrics?: ProviderCallMetrics;
}

export interface QuestionGenerationProvider {
  generate(request: GenerationProviderRequest): Promise<GenerationProviderResult>;
  embedTexts?(texts: string[]): Promise<EmbeddingCallResult>;
}

export interface ValidatedQuestionPayload {
  subject: string;
  classLevel: ClassLevel;
  chapter: string;
  subTopic: string;
  targetExams: TargetExam[];
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  correctIndex: number;
  conceptTested: string;
  commonMistake: string;
  recommendedRemedialAction: string;
  learningOutcome: string;
  bloomsTaxonomyLevel: string;
  examRelevance: ExamRelevanceMap;
  sourceReference: string | null;
  normalizedText: string;
  normalizedHash: string;
  structuralFingerprint: string;
  semanticEmbedding: number[] | null;
  metadata: Record<string, unknown>;
}

export interface SubjectGenerationContext {
  configuration: SubjectConfiguration;
  targetExams: TargetExam[];
  previousQuestionTexts: string[];
  provider: QuestionGenerationProvider;
}
