"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importHistoricalPapersSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../constants/domain");
const importQuestionSchema = zod_1.z.object({
    questionNumber: zod_1.z.number().int().positive(),
    chapter: zod_1.z.string().trim().min(1).max(200),
    subTopic: zod_1.z.string().trim().min(1).max(200),
    text: zod_1.z.string().trim().min(10),
    options: zod_1.z.array(zod_1.z.string().trim().min(1)).length(4).optional(),
    correctOption: zod_1.z.enum(["A", "B", "C", "D"]).optional(),
    conceptTags: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
const importPaperSchema = zod_1.z.object({
    exam: zod_1.z.enum(domain_1.TARGET_EXAMS),
    year: zod_1.z.number().int().min(2000).max(new Date().getFullYear()),
    subject: zod_1.z.string().trim().min(2).max(100),
    classLevel: zod_1.z.enum(domain_1.CLASS_LEVELS).optional().nullable(),
    sourceLabel: zod_1.z.string().trim().min(2).max(200),
    sourceUrl: zod_1.z.url().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    questions: zod_1.z.array(importQuestionSchema).min(1),
});
exports.importHistoricalPapersSchema = zod_1.z.object({
    papers: zod_1.z.array(importPaperSchema).min(1),
});
//# sourceMappingURL=historical-paper.dto.js.map