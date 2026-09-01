import { z } from "zod";
import { CLASS_LEVELS, TARGET_EXAMS } from "../constants/domain";

const importQuestionSchema = z.object({
  questionNumber: z.number().int().positive(),
  chapter: z.string().trim().min(1).max(200),
  subTopic: z.string().trim().min(1).max(200),
  text: z.string().trim().min(10),
  options: z.array(z.string().trim().min(1)).length(4).optional(),
  correctOption: z.enum(["A", "B", "C", "D"]).optional(),
  conceptTags: z.array(z.string().trim().min(1)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const importPaperSchema = z.object({
  exam: z.enum(TARGET_EXAMS),
  year: z.number().int().min(2000).max(new Date().getFullYear()),
  subject: z.string().trim().min(2).max(100),
  classLevel: z.enum(CLASS_LEVELS).optional().nullable(),
  sourceLabel: z.string().trim().min(2).max(200),
  sourceUrl: z.url().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(importQuestionSchema).min(1),
});

export const importHistoricalPapersSchema = z.object({
  papers: z.array(importPaperSchema).min(1),
});

export type ImportHistoricalPapersInput = z.infer<typeof importHistoricalPapersSchema>;
