import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { HistoricalPaper } from "./historical-paper.entity";

@Entity({ name: "historical_questions" })
@Index("historical_questions_normalized_hash_idx", ["normalizedHash"])
@Index("historical_questions_structural_fingerprint_idx", ["structuralFingerprint"])
export class HistoricalQuestion extends BaseEntity {
  @Column({ type: "uuid" })
  paperId!: string;

  @ManyToOne(() => HistoricalPaper, (paper) => paper.questions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "paperId" })
  paper!: HistoricalPaper;

  @Column({ type: "int" })
  questionNumber!: number;

  @Column({ type: "text" })
  subject!: string;

  @Column({ type: "text" })
  chapter!: string;

  @Column({ type: "text" })
  chapterNormalized!: string;

  @Column({ type: "text" })
  subTopic!: string;

  @Column({ type: "text" })
  subTopicNormalized!: string;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "text" })
  normalizedText!: string;

  @Column({ type: "text" })
  normalizedHash!: string;

  @Column({ type: "text" })
  structuralFingerprint!: string;

  @Column({ type: "jsonb", nullable: true })
  options!: string[] | null;

  @Column({ type: "text", nullable: true })
  correctOption!: string | null;

  @Column({ type: "jsonb", nullable: true })
  conceptTags!: string[] | null;

  @Column({ type: "jsonb", nullable: true })
  semanticEmbedding!: number[] | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;
}
