"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalQuestion = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const historical_paper_entity_1 = require("./historical-paper.entity");
let HistoricalQuestion = class HistoricalQuestion extends base_entity_1.BaseEntity {
    paperId;
    paper;
    questionNumber;
    subject;
    chapter;
    chapterNormalized;
    subTopic;
    subTopicNormalized;
    text;
    normalizedText;
    normalizedHash;
    structuralFingerprint;
    options;
    correctOption;
    conceptTags;
    semanticEmbedding;
    metadata;
};
exports.HistoricalQuestion = HistoricalQuestion;
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "paperId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => historical_paper_entity_1.HistoricalPaper, (paper) => paper.questions, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "paperId" }),
    __metadata("design:type", historical_paper_entity_1.HistoricalPaper)
], HistoricalQuestion.prototype, "paper", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], HistoricalQuestion.prototype, "questionNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "chapter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "chapterNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "subTopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "subTopicNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "normalizedText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "normalizedHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalQuestion.prototype, "structuralFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HistoricalQuestion.prototype, "options", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], HistoricalQuestion.prototype, "correctOption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HistoricalQuestion.prototype, "conceptTags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HistoricalQuestion.prototype, "semanticEmbedding", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HistoricalQuestion.prototype, "metadata", void 0);
exports.HistoricalQuestion = HistoricalQuestion = __decorate([
    (0, typeorm_1.Entity)({ name: "historical_questions" }),
    (0, typeorm_1.Index)("historical_questions_normalized_hash_idx", ["normalizedHash"]),
    (0, typeorm_1.Index)("historical_questions_structural_fingerprint_idx", ["structuralFingerprint"])
], HistoricalQuestion);
//# sourceMappingURL=historical-question.entity.js.map