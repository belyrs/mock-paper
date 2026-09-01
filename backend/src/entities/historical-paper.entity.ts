import { Column, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { HistoricalQuestion } from "./historical-question.entity";
import type { ClassLevel, TargetExam } from "../constants/domain";

@Entity({ name: "historical_papers" })
export class HistoricalPaper extends BaseEntity {
  @Column({ type: "text" })
  exam!: TargetExam;

  @Column({ type: "int" })
  year!: number;

  @Column({ type: "text" })
  subject!: string;

  @Column({ type: "text", nullable: true })
  classLevel!: ClassLevel | null;

  @Column({ type: "text" })
  sourceLabel!: string;

  @Column({ type: "text", nullable: true })
  sourceUrl!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @OneToMany(() => HistoricalQuestion, (question) => question.paper)
  questions!: HistoricalQuestion[];
}
