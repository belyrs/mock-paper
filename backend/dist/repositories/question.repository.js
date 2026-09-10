"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionRepository = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const question_entity_1 = require("../entities/question.entity");
class QuestionRepository {
    repository;
    constructor(dataSource) {
        this.repository = dataSource.getRepository(question_entity_1.Question);
    }
    create(payload) {
        return this.repository.create({
            ...payload,
            id: payload.id ?? node_crypto_1.default.randomUUID(),
        });
    }
    saveMany(questions) {
        return this.repository.save(questions.map((question) => this.repository.create({
            ...question,
            id: question.id ?? node_crypto_1.default.randomUUID(),
        })));
    }
    save(question) {
        return this.repository.save(this.repository.create({
            ...question,
            id: question.id ?? node_crypto_1.default.randomUUID(),
        }));
    }
    async updateSemanticArtifacts(payload) {
        await Promise.all(payload.map((item) => this.repository.update(item.id, {
            semanticEmbedding: item.semanticEmbedding ?? null,
        })));
    }
    findById(id) {
        return this.repository.findOne({
            where: { id },
            relations: { paper: true },
        });
    }
    findRelevantForDeduplication(payload) {
        return this.repository
            .find({
            where: {
                subject: payload.subject,
                classLevel: payload.classLevel,
                chapterNormalized: payload.chapterNormalized,
                subTopicNormalized: payload.subTopicNormalized,
            },
            order: { createdAt: "DESC" },
            take: payload.limit ?? 40,
        })
            .then((questions) => payload.excludePaperId
            ? questions.filter((question) => question.paperId !== payload.excludePaperId)
            : questions);
    }
}
exports.QuestionRepository = QuestionRepository;
//# sourceMappingURL=question.repository.js.map