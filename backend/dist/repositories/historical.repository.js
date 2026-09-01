"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalRepository = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const historical_paper_entity_1 = require("../entities/historical-paper.entity");
const historical_question_entity_1 = require("../entities/historical-question.entity");
class HistoricalRepository {
    paperRepository;
    questionRepository;
    constructor(dataSource) {
        this.paperRepository = dataSource.getRepository(historical_paper_entity_1.HistoricalPaper);
        this.questionRepository = dataSource.getRepository(historical_question_entity_1.HistoricalQuestion);
    }
    createPaper(payload) {
        return this.paperRepository.create({
            ...payload,
            id: payload.id ?? node_crypto_1.default.randomUUID(),
        });
    }
    savePaper(paper) {
        return this.paperRepository.save(this.paperRepository.create({
            ...paper,
            id: paper.id ?? node_crypto_1.default.randomUUID(),
        }));
    }
    createQuestion(payload) {
        return this.questionRepository.create({
            ...payload,
            id: payload.id ?? node_crypto_1.default.randomUUID(),
        });
    }
    saveQuestions(questions) {
        return this.questionRepository.save(questions.map((question) => this.questionRepository.create({
            ...question,
            id: question.id ?? node_crypto_1.default.randomUUID(),
        })));
    }
    async updateSemanticArtifacts(payload) {
        await Promise.all(payload.map((item) => this.questionRepository.update(item.id, {
            semanticEmbedding: item.semanticEmbedding ?? null,
        })));
    }
    countQuestions() {
        return this.questionRepository.count();
    }
    findRelevantQuestions(payload) {
        return this.questionRepository.find({
            where: [
                {
                    subject: payload.subject,
                    chapterNormalized: payload.chapterNormalized,
                },
                {
                    subject: payload.subject,
                    subTopicNormalized: payload.subTopicNormalized,
                },
            ],
            relations: { paper: true },
            order: {
                paper: { year: "DESC" },
                questionNumber: "ASC",
            },
        });
    }
}
exports.HistoricalRepository = HistoricalRepository;
//# sourceMappingURL=historical.repository.js.map