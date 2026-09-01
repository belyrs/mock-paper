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
exports.HistoricalPaper = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const historical_question_entity_1 = require("./historical-question.entity");
let HistoricalPaper = class HistoricalPaper extends base_entity_1.BaseEntity {
    exam;
    year;
    subject;
    classLevel;
    sourceLabel;
    sourceUrl;
    metadata;
    questions;
};
exports.HistoricalPaper = HistoricalPaper;
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalPaper.prototype, "exam", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], HistoricalPaper.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalPaper.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], HistoricalPaper.prototype, "classLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], HistoricalPaper.prototype, "sourceLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], HistoricalPaper.prototype, "sourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HistoricalPaper.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => historical_question_entity_1.HistoricalQuestion, (question) => question.paper),
    __metadata("design:type", Array)
], HistoricalPaper.prototype, "questions", void 0);
exports.HistoricalPaper = HistoricalPaper = __decorate([
    (0, typeorm_1.Entity)({ name: "historical_papers" })
], HistoricalPaper);
//# sourceMappingURL=historical-paper.entity.js.map