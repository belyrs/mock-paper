"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuestionSchema = exports.renamePaperSchema = exports.generatePaperSchema = exports.subjectConfigurationSchema = exports.difficultyMixSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../constants/domain");
exports.difficultyMixSchema = zod_1.z
    .object({
    Easy: zod_1.z.number().int().min(0).max(100),
    Medium: zod_1.z.number().int().min(0).max(100),
    Hard: zod_1.z.number().int().min(0).max(100),
})
    .refine((value) => value.Easy + value.Medium + value.Hard === 100, {
    message: "Difficulty mix must total 100",
    path: ["Easy"],
});
exports.subjectConfigurationSchema = zod_1.z.object({
    subject: zod_1.z.string().trim().min(2).max(100),
    chapter: zod_1.z.string().trim().min(1).max(200),
    subTopic: zod_1.z.string().trim().min(1).max(200),
    numberOfQuestions: zod_1.z.number().int().min(1).max(50),
    mix: exports.difficultyMixSchema,
});
exports.generatePaperSchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2).max(160).optional(),
    exam: zod_1.z.enum(domain_1.APP_EXAMS),
    classLevel: zod_1.z.enum(domain_1.CLASS_LEVELS),
    mode: zod_1.z.enum(domain_1.PAPER_MODES),
    targetExams: zod_1.z.array(zod_1.z.enum(domain_1.TARGET_EXAMS)).min(1).optional(),
    subjects: zod_1.z.array(exports.subjectConfigurationSchema).min(1),
})
    .superRefine((value, ctx) => {
    if (value.mode === "individual" && value.subjects.length !== 1) {
        ctx.addIssue({
            code: "custom",
            path: ["subjects"],
            message: "Individual mode must contain exactly one subject configuration.",
        });
    }
});
exports.renamePaperSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(160),
});
exports.updateQuestionSchema = zod_1.z.object({
    text: zod_1.z.string().trim().min(10),
    options: zod_1.z.array(zod_1.z.string().trim().min(1)).length(4),
    correctOption: zod_1.z.enum(["A", "B", "C", "D"]),
    difficulty: zod_1.z.enum(domain_1.DIFFICULTIES).optional(),
    conceptTested: zod_1.z.string().trim().min(1),
    commonMistake: zod_1.z.string().trim().min(1),
    recommendedRemedialAction: zod_1.z.string().trim().min(1),
    learningOutcome: zod_1.z.string().trim().min(1),
    bloomsTaxonomyLevel: zod_1.z.string().trim().min(1),
    sourceReference: zod_1.z.string().trim().optional().nullable(),
    examRelevance: zod_1.z.object({
        JEE_MAIN: zod_1.z.string().optional(),
        NEET: zod_1.z.string().optional(),
        KCET: zod_1.z.string().optional(),
        CBSE: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=paper.dto.js.map