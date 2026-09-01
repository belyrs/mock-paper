"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalAnalysisService = void 0;
const logger_1 = require("../config/logger");
const normalization_1 = require("../utils/normalization");
function mostCommon(values, limit = 5) {
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([value]) => value);
}
class HistoricalAnalysisService {
    historicalRepository;
    constructor(historicalRepository) {
        this.historicalRepository = historicalRepository;
    }
    async analyseSubjectConfiguration(configuration, _targetExams) {
        const relevantQuestions = await this.historicalRepository.findRelevantQuestions({
            subject: configuration.subject,
            chapterNormalized: (0, normalization_1.normalizeTopicKey)(configuration.chapter),
            subTopicNormalized: (0, normalization_1.normalizeTopicKey)(configuration.subTopic),
        });
        if (relevantQuestions.length === 0) {
            logger_1.logger.info({
                subject: configuration.subject,
                chapter: configuration.chapter,
                subTopic: configuration.subTopic,
            }, "No imported historical dataset matched the requested syllabus slice. Using model-knowledge fallback guidance.");
            return {
                mode: "model_knowledge_fallback",
                totalRelevantQuestions: 0,
                yearsCovered: [],
                trendSummary: "No imported historical paper dataset is available for this syllabus slice. The LLM must rely on general public exam-pattern knowledge instead of a local archival corpus.",
                recurringConcepts: [],
                difficultyNotes: [
                    "Historical-paper import is currently unavailable for the requested syllabus.",
                ],
                sourceDetails: [
                    "Local historical paper corpus not present in the database at generation time.",
                ],
            };
        }
        const yearsCovered = [...new Set(relevantQuestions.map((question) => question.paper.year))].sort((left, right) => left - right);
        const conceptPool = relevantQuestions.flatMap((question) => question.conceptTags ?? []);
        const recurringConcepts = mostCommon(conceptPool, 6);
        logger_1.logger.info({
            subject: configuration.subject,
            chapter: configuration.chapter,
            subTopic: configuration.subTopic,
            matchedHistoricalQuestionCount: relevantQuestions.length,
            yearsCovered,
        }, "Imported historical dataset matched the requested syllabus slice.");
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
                .map((question) => `${question.paper.exam} ${question.paper.year} — ${question.paper.sourceLabel} — Q${question.questionNumber}`),
        };
    }
}
exports.HistoricalAnalysisService = HistoricalAnalysisService;
//# sourceMappingURL=historical-analysis.service.js.map