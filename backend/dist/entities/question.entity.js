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
exports.Question = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const paper_entity_1 = require("./paper.entity");
let Question = class Question extends base_entity_1.BaseEntity {
    paperId;
    paper;
    position;
    subject;
    classLevel;
    chapter;
    chapterNormalized;
    subTopic;
    subTopicNormalized;
    targetExams;
    difficulty;
    questionType;
    text;
    normalizedText;
    normalizedHash;
    structuralFingerprint;
    options;
    correctOption;
    correctIndex;
    conceptTested;
    commonMistake;
    recommendedRemedialAction;
    learningOutcome;
    bloomsTaxonomyLevel;
    examRelevance;
    sourceReference;
    generationProvider;
    generationModel;
    promptVersion;
    semanticEmbedding;
    metadata;
};
exports.Question = Question;
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], Question.prototype, "paperId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => paper_entity_1.Paper, (paper) => paper.questions, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "paperId" }),
    __metadata("design:type", paper_entity_1.Paper)
], Question.prototype, "paper", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], Question.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Index)("questions_subject_idx"),
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "classLevel", void 0);
__decorate([
    (0, typeorm_1.Index)("questions_chapter_normalized_idx"),
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "chapter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "chapterNormalized", void 0);
__decorate([
    (0, typeorm_1.Index)("questions_sub_topic_normalized_idx"),
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "subTopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "subTopicNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Array)
], Question.prototype, "targetExams", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "MCQ" }),
    __metadata("design:type", String)
], Question.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "normalizedText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "normalizedHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "structuralFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Array)
], Question.prototype, "options", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "correctOption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], Question.prototype, "correctIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "conceptTested", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "commonMistake", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "recommendedRemedialAction", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "learningOutcome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "bloomsTaxonomyLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], Question.prototype, "examRelevance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Question.prototype, "sourceReference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "generationProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "generationModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Question.prototype, "promptVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Question.prototype, "semanticEmbedding", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Question.prototype, "metadata", void 0);
exports.Question = Question = __decorate([
    (0, typeorm_1.Entity)({ name: "questions" }),
    (0, typeorm_1.Index)("questions_normalized_hash_unique", ["normalizedHash"], { unique: true }),
    (0, typeorm_1.Index)("questions_structural_fingerprint_idx", ["structuralFingerprint"])
], Question);
//# sourceMappingURL=question.entity.js.map