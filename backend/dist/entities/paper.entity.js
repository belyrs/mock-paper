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
exports.Paper = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const question_entity_1 = require("./question.entity");
const generation_run_entity_1 = require("./generation-run.entity");
let Paper = class Paper extends base_entity_1.BaseEntity {
    userId;
    user;
    title;
    exam;
    classLevel;
    mode;
    targetExams;
    subjectConfigurations;
    questionCount;
    status;
    generationProvider;
    generationModel;
    promptVersion;
    historicalAnalysisMode;
    historicalAnalysisSummary;
    validationSummary;
    notes;
    questions;
    generationRuns;
};
exports.Paper = Paper;
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], Paper.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.papers, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "userId" }),
    __metadata("design:type", user_entity_1.User)
], Paper.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Index)("papers_title_idx"),
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "exam", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "classLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Array)
], Paper.prototype, "targetExams", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Array)
], Paper.prototype, "subjectConfigurations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], Paper.prototype, "questionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "active" }),
    __metadata("design:type", String)
], Paper.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "generationProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "generationModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "promptVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Paper.prototype, "historicalAnalysisMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], Paper.prototype, "historicalAnalysisSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], Paper.prototype, "validationSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Paper.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => question_entity_1.Question, (question) => question.paper),
    __metadata("design:type", Array)
], Paper.prototype, "questions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => generation_run_entity_1.GenerationRun, (generationRun) => generationRun.paper),
    __metadata("design:type", Array)
], Paper.prototype, "generationRuns", void 0);
exports.Paper = Paper = __decorate([
    (0, typeorm_1.Entity)({ name: "papers" })
], Paper);
//# sourceMappingURL=paper.entity.js.map