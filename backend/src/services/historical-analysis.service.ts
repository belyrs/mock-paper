import type {
  HistoricalAnalysisSummary,
  SubjectConfiguration,
  TargetExam,
} from "../constants/domain";
import { logger } from "../config/logger";
import { HistoricalRepository } from "../repositories/historical.repository";
import { normalizeTopicKey } from "../utils/normalization";

function mostCommon<T>(values: T[], limit = 5): T[] {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export class HistoricalAnalysisService {
  constructor(private readonly historicalRepository: HistoricalRepository) {}

  async analyseSubjectConfiguration(
    configuration: SubjectConfiguration,
    _targetExams: TargetExam[],
  ): Promise<HistoricalAnalysisSummary> {
    const relevantQuestions = await this.historicalRepository.findRelevantQuestions({
      subject: configuration.subject,
      chapterNormalized: normalizeTopicKey(configuration.chapter),
      subTopicNormalized: normalizeTopicKey(configuration.subTopic),
    });

    if (relevantQuestions.length === 0) {
      logger.info(
        {
          subject: configuration.subject,
          chapter: configuration.chapter,
          subTopic: configuration.subTopic,
        },
        "No imported historical dataset matched the requested syllabus slice. Using model-knowledge fallback guidance.",
      );
      return {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary:
          "No imported historical paper dataset is available for this syllabus slice. The LLM must rely on general public exam-pattern knowledge instead of a local archival corpus.",
        recurringConcepts: [],
        difficultyNotes: [
          "Historical-paper import is currently unavailable for the requested syllabus.",
        ],
        sourceDetails: [
          "Local historical paper corpus not present in the database at generation time.",
        ],
      };
    }

    const yearsCovered = [...new Set(relevantQuestions.map((question) => question.paper.year))].sort(
      (left, right) => left - right,
    );

    const conceptPool = relevantQuestions.flatMap((question) => question.conceptTags ?? []);
    const recurringConcepts = mostCommon(conceptPool, 6);

    logger.info(
      {
        subject: configuration.subject,
        chapter: configuration.chapter,
        subTopic: configuration.subTopic,
        matchedHistoricalQuestionCount: relevantQuestions.length,
        yearsCovered,
      },
      "Imported historical dataset matched the requested syllabus slice.",
    );

    return {
      mode: "imported_dataset",
      totalRelevantQuestions: relevantQuestions.length,
      yearsCovered,
      trendSummary: `Imported dataset contains ${relevantQuestions.length} relevant historical question(s) across ${yearsCovered.length} year(s) for ${configuration.subject}.`,
      recurringConcepts,
      difficultyNotes: [
        "Difficulty should reflect the distribution requested by the user while staying close to historically recurring concept patterns.",
      ],
      sourceDetails: relevantQuestions
        .slice(0, 4)
        .map(
          (question) =>
            `${question.paper.exam} ${question.paper.year} — ${question.paper.sourceLabel} — Q${question.questionNumber}`,
        ),
    };
  }
}
