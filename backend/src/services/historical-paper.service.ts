import type { ImportHistoricalPapersInput } from "../dtos/historical-paper.dto";
import { HistoricalRepository } from "../repositories/historical.repository";
import {
  hashNormalizedText,
  hashStructuralText,
  normalizeText,
  normalizeTopicKey,
} from "../utils/normalization";

export class HistoricalPaperService {
  constructor(private readonly historicalRepository: HistoricalRepository) {}

  async importStructuredPapers(input: ImportHistoricalPapersInput) {
    let importedPaperCount = 0;
    let importedQuestionCount = 0;

    for (const paperInput of input.papers) {
      const paper = this.historicalRepository.createPaper({
        exam: paperInput.exam,
        year: paperInput.year,
        subject: paperInput.subject,
        classLevel: paperInput.classLevel ?? null,
        sourceLabel: paperInput.sourceLabel,
        sourceUrl: paperInput.sourceUrl ?? null,
        metadata: paperInput.metadata ?? null,
      });

      const savedPaper = await this.historicalRepository.savePaper(paper);
      importedPaperCount += 1;

      const questions = paperInput.questions.map((questionInput) =>
        this.historicalRepository.createQuestion({
          paperId: savedPaper.id,
          questionNumber: questionInput.questionNumber,
          subject: paperInput.subject,
          chapter: questionInput.chapter,
          chapterNormalized: normalizeTopicKey(questionInput.chapter),
          subTopic: questionInput.subTopic,
          subTopicNormalized: normalizeTopicKey(questionInput.subTopic),
          text: questionInput.text,
          normalizedText: normalizeText(questionInput.text),
          normalizedHash: hashNormalizedText(questionInput.text),
          structuralFingerprint: hashStructuralText(questionInput.text),
          options: questionInput.options ?? null,
          correctOption: questionInput.correctOption ?? null,
          conceptTags: questionInput.conceptTags ?? null,
          semanticEmbedding: null,
          metadata: questionInput.metadata ?? null,
        }),
      );

      await this.historicalRepository.saveQuestions(questions);
      importedQuestionCount += questions.length;
    }

    return {
      importedPaperCount,
      importedQuestionCount,
    };
  }

  async getStatus() {
    const totalImportedQuestions = await this.historicalRepository.countQuestions();
    return {
      totalImportedQuestions,
      isHistoricalDatasetAvailable: totalImportedQuestions > 0,
    };
  }
}
