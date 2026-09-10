import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Paper } from "./paper.entity";
import type {
  ClassLevel,
  Difficulty,
  ExamRelevanceMap,
  QuestionType,
  TargetExam,
} from "../constants/domain";

@Entity({ name: "questions" })
@Index(
  "questions_paper_normalized_hash_unique",
  ["paperId", "normalizedHash"],
  {
    unique: true,
  },
)
@Index("questions_structural_fingerprint_idx", ["structuralFingerprint"])
export class Question extends BaseEntity {
  @Column({ type: "uuid" })
  paperId!: string;

  @ManyToOne(() => Paper, (paper) => paper.questions, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "paperId" })
  paper!: Paper;

  @Column({ type: "int" })
  position!: number;

  @Index("questions_subject_idx")
  @Column({ type: "text" })
  subject!: string;

  @Column({ type: "text" })
  classLevel!: ClassLevel;

  @Index("questions_chapter_normalized_idx")
  @Column({ type: "text" })
  chapter!: string;

  @Column({ type: "text" })
  chapterNormalized!: string;

  @Index("questions_sub_topic_normalized_idx")
  @Column({ type: "text" })
  subTopic!: string;

  @Column({ type: "text" })
  subTopicNormalized!: string;

  @Column({ type: "jsonb" })
  targetExams!: TargetExam[];

  @Column({ type: "text" })
  difficulty!: Difficulty;

  @Column({ type: "text", default: "MCQ" })
  questionType!: QuestionType;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "text" })
  normalizedText!: string;

  @Column({ type: "text" })
  normalizedHash!: string;

  @Column({ type: "text" })
  structuralFingerprint!: string;

  @Column({ type: "jsonb" })
  options!: string[];

  @Column({ type: "text" })
  correctOption!: string;

  @Column({ type: "int" })
  correctIndex!: number;

  @Column({ type: "text" })
  conceptTested!: string;

  @Column({ type: "text" })
  commonMistake!: string;

  @Column({ type: "text" })
  recommendedRemedialAction!: string;

  @Column({ type: "text" })
  learningOutcome!: string;

  @Column({ type: "text" })
  bloomsTaxonomyLevel!: string;

  @Column({ type: "jsonb" })
  examRelevance!: ExamRelevanceMap;

  @Column({ type: "text", nullable: true })
  sourceReference!: string | null;

  @Column({ type: "text" })
  generationProvider!: string;

  @Column({ type: "text" })
  generationModel!: string;

  @Column({ type: "text" })
  promptVersion!: string;

  @Column({ type: "jsonb", nullable: true })
  semanticEmbedding!: number[] | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;
}
