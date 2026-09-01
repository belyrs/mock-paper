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
exports.GenerationRun = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const paper_entity_1 = require("./paper.entity");
let GenerationRun = class GenerationRun extends base_entity_1.BaseEntity {
    paperId;
    paper;
    status;
    provider;
    model;
    promptVersion;
    requestPayload;
    responsePayload;
    validationReport;
    failureReason;
};
exports.GenerationRun = GenerationRun;
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], GenerationRun.prototype, "paperId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => paper_entity_1.Paper, (paper) => paper.generationRuns, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "paperId" }),
    __metadata("design:type", paper_entity_1.Paper)
], GenerationRun.prototype, "paper", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], GenerationRun.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], GenerationRun.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], GenerationRun.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], GenerationRun.prototype, "promptVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], GenerationRun.prototype, "requestPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], GenerationRun.prototype, "responsePayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], GenerationRun.prototype, "validationReport", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], GenerationRun.prototype, "failureReason", void 0);
exports.GenerationRun = GenerationRun = __decorate([
    (0, typeorm_1.Entity)({ name: "generation_runs" })
], GenerationRun);
//# sourceMappingURL=generation-run.entity.js.map