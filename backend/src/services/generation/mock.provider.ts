import { AppError } from "../../errors/app-error";
import { getSyllabusGroundingEntryByKey } from "../../data/syllabus-grounding";
import { mixToCounts } from "../../utils/difficulty";
import { normalizeText } from "../../utils/normalization";
import type {
  EmbeddingCallResult,
  GenerationProviderRequest,
  GenerationProviderResult,
  QuestionGenerationProvider,
} from "./types";

function examRelevanceFor(request: GenerationProviderRequest) {
  return {
    JEE_MAIN: request.targetExams.includes("JEE_MAIN") ? "High" : "N/A",
    NEET: request.targetExams.includes("NEET") ? "High" : "N/A",
    KCET: request.targetExams.includes("KCET") ? "Medium" : "N/A",
    CBSE: request.targetExams.includes("CBSE") ? "Medium" : "N/A",
  };
}

function pickTemplates<T>(templates: T[], count: number, seed: number) {
  if (count === 0) {
    return [] as T[];
  }

  const start = Math.abs(seed) % templates.length;
  const ordered = [...templates.slice(start), ...templates.slice(0, start)];
  return ordered.slice(0, count);
}

function pickNonRepeatingTemplates<
  T extends { build: () => { questionText: string } },
>(templates: T[], count: number, seed: number, previousQuestions: Set<string>) {
  if (count === 0) {
    return [] as T[];
  }

  const ordered = pickTemplates(templates, templates.length, seed);
  const picked: T[] = [];

  for (const template of ordered) {
    const normalizedText = normalizeText(template.build().questionText);
    if (previousQuestions.has(normalizedText)) {
      continue;
    }
    picked.push(template);
    if (picked.length === count) {
      break;
    }
  }

  if (picked.length < count) {
    throw new AppError(
      503,
      "MOCK_PROVIDER_CAPACITY_EXCEEDED",
      "The offline fallback question bank for this syllabus slice is exhausted for additional non-repeating questions. Add a working OPENAI_API_KEY with available quota, restart the backend, or choose a different chapter/sub-topic.",
    );
  }

  return picked;
}

export class MockQuestionGenerationProvider implements QuestionGenerationProvider {
  async generate(request: GenerationProviderRequest): Promise<GenerationProviderResult> {
    const entry = request.syllabusContext.entryKey
      ? getSyllabusGroundingEntryByKey(request.syllabusContext.entryKey)
      : null;

    if (!entry) {
      throw new AppError(
        503,
        "MOCK_PROVIDER_UNSUPPORTED_TOPIC",
        "The deterministic fallback generator does not support this syllabus slice. Configure a working OpenAI API key or add local syllabus templates for this topic.",
        {
          subject: request.subject,
          chapter: request.chapter,
          subTopic: request.subTopic,
        },
      );
    }

    const counts = request.difficultyCounts ?? mixToCounts(request.difficultyMix, request.questionCount);
    const perDifficulty = {
      Easy: entry.mockQuestionTemplates.filter((template) => template.difficulty === "Easy"),
      Medium: entry.mockQuestionTemplates.filter((template) => template.difficulty === "Medium"),
      Hard: entry.mockQuestionTemplates.filter((template) => template.difficulty === "Hard"),
    } as const;

    for (const [difficulty, count] of Object.entries(counts)) {
      if (count > perDifficulty[difficulty as keyof typeof perDifficulty].length) {
        throw new AppError(
          503,
          "MOCK_PROVIDER_CAPACITY_EXCEEDED",
          "The offline fallback question bank for this syllabus slice is too small for the requested non-repeating difficulty mix. Add a working OPENAI_API_KEY with available quota, restart the backend, or choose a different chapter/sub-topic.",
          {
            subject: request.subject,
            chapter: request.chapter,
            subTopic: request.subTopic,
            difficulty,
            requested: count,
            available: perDifficulty[difficulty as keyof typeof perDifficulty].length,
          },
        );
      }
    }

    const seed = request.previousQuestions
      .join("|")
      .split("")
      .reduce((total, character) => total + character.charCodeAt(0), entry.key.length * 17);
    const previousQuestions = new Set(request.previousQuestions.map((question) => normalizeText(question)));
    const selectedTemplates = [
      ...pickNonRepeatingTemplates(perDifficulty.Easy, counts.Easy, seed + 11, previousQuestions),
      ...pickNonRepeatingTemplates(perDifficulty.Medium, counts.Medium, seed + 23, previousQuestions),
      ...pickNonRepeatingTemplates(perDifficulty.Hard, counts.Hard, seed + 37, previousQuestions),
    ];

    const examRelevance = examRelevanceFor(request);
    const questions = selectedTemplates.map((template, index) => {
      const built = template.build();
      return {
        questionNumber: index + 1,
        difficulty: template.difficulty,
        questionText: built.questionText,
        options: built.options,
        correctOption: built.correctOption,
        conceptTested: template.conceptTested,
        commonMistake: template.commonMistake,
        recommendedRemedialAction: template.recommendedRemedialAction,
        learningOutcome: template.learningOutcome,
        bloomsTaxonomyLevel: template.bloomsTaxonomyLevel,
        examRelevance,
        sourceReference: template.sourceReference,
      };
    });

    return {
      rawPrompt: `deterministic-syllabus-fallback:${entry.key}`,
      rawResponse: {
        syllabusEntry: entry.key,
        questions,
      },
      provider: "mock",
      model: "deterministic-syllabus-fallback",
      questions,
      historicalAnalysisMode: request.historicalAnalysis.mode,
      historicalAnalysisSummary: request.historicalAnalysis.trendSummary,
      metrics: {
        provider: "mock",
        model: "deterministic-syllabus-fallback",
        latencyMs: 0,
        promptCharacters: 0,
        responseCharacters: JSON.stringify(questions).length,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cachedPromptTokens: 0,
        },
      },
    };
  }

  async embedTexts(texts: string[]): Promise<EmbeddingCallResult> {
    return {
      provider: "mock",
      model: "deterministic-syllabus-fallback",
      latencyMs: 0,
      inputCount: texts.length,
      embeddings: texts.map(() => []),
      usage: {
        promptTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
