import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Paper } from "./paper.entity";
import type { GenerationStatus } from "../constants/domain";

@Entity({ name: "generation_runs" })
export class GenerationRun extends BaseEntity {
  @Column({ type: "uuid" })
  paperId!: string;

  @ManyToOne(() => Paper, (paper) => paper.generationRuns, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "paperId" })
  paper!: Paper;

  @Column({ type: "text" })
  status!: GenerationStatus;

  @Column({ type: "text" })
  provider!: string;

  @Column({ type: "text" })
  model!: string;

  @Column({ type: "text" })
  promptVersion!: string;

  @Column({ type: "jsonb" })
  requestPayload!: Record<string, unknown>;

  @Column({ type: "jsonb" })
  responsePayload!: Record<string, unknown>;

  @Column({ type: "jsonb" })
  validationReport!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  failureReason!: string | null;
}
