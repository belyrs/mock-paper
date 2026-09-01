import { z } from "zod";
import {
  APP_EXAMS,
  CLASS_LEVELS,
  DIFFICULTIES,
  PAPER_MODES,
  TARGET_EXAMS,
} from "../constants/domain";

export const difficultyMixSchema = z
  .object({
    Easy: z.number().int().min(0).max(100),
    Medium: z.number().int().min(0).max(100),
    Hard: z.number().int().min(0).max(100),
  })
  .refine((value) => value.Easy + value.Medium + value.Hard === 100, {
    message: "Difficulty mix must total 100",
    path: ["Easy"],
  });

export const subjectConfigurationSchema = z.object({
  subject: z.string().trim().min(2).max(100),
  chapter: z.string().trim().min(1).max(200),
  subTopic: z.string().trim().min(1).max(200),
  numberOfQuestions: z.number().int().min(1).max(50),
  mix: difficultyMixSchema,
});

export const generatePaperSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    exam: z.enum(APP_EXAMS),
    classLevel: z.enum(CLASS_LEVELS),
    mode: z.enum(PAPER_MODES),
    targetExams: z.array(z.enum(TARGET_EXAMS)).min(1).optional(),
    subjects: z.array(subjectConfigurationSchema).min(1),
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

export const renamePaperSchema = z.object({
  title: z.string().trim().min(2).max(160),
});

export const updateQuestionSchema = z.object({
  text: z.string().trim().min(10),
  options: z.array(z.string().trim().min(1)).length(4),
  correctOption: z.enum(["A", "B", "C", "D"]),
  difficulty: z.enum(DIFFICULTIES).optional(),
  conceptTested: z.string().trim().min(1),
  commonMistake: z.string().trim().min(1),
  recommendedRemedialAction: z.string().trim().min(1),
  learningOutcome: z.string().trim().min(1),
  bloomsTaxonomyLevel: z.string().trim().min(1),
  sourceReference: z.string().trim().optional().nullable(),
  examRelevance: z.object({
    JEE_MAIN: z.string().optional(),
    NEET: z.string().optional(),
    KCET: z.string().optional(),
    CBSE: z.string().optional(),
  }),
});

export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;
export type SubjectConfigurationInput = z.infer<typeof subjectConfigurationSchema>;
export type RenamePaperInput = z.infer<typeof renamePaperSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
