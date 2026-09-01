"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalPaperService = void 0;
const normalization_1 = require("../utils/normalization");
class HistoricalPaperService {
    historicalRepository;
    constructor(historicalRepository) {
        this.historicalRepository = historicalRepository;
    }
    async importStructuredPapers(input) {
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
            const questions = paperInput.questions.map((questionInput) => this.historicalRepository.createQuestion({
                paperId: savedPaper.id,
                questionNumber: questionInput.questionNumber,
                subject: paperInput.subject,
                chapter: questionInput.chapter,
                chapterNormalized: (0, normalization_1.normalizeTopicKey)(questionInput.chapter),
                subTopic: questionInput.subTopic,
                subTopicNormalized: (0, normalization_1.normalizeTopicKey)(questionInput.subTopic),
                text: questionInput.text,
                normalizedText: (0, normalization_1.normalizeText)(questionInput.text),
                normalizedHash: (0, normalization_1.hashNormalizedText)(questionInput.text),
                structuralFingerprint: (0, normalization_1.hashStructuralText)(questionInput.text),
                options: questionInput.options ?? null,
                correctOption: questionInput.correctOption ?? null,
                conceptTags: questionInput.conceptTags ?? null,
                semanticEmbedding: null,
                metadata: questionInput.metadata ?? null,
            }));
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
exports.HistoricalPaperService = HistoricalPaperService;
//# sourceMappingURL=historical-paper.service.js.map