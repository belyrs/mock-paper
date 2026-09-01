import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Question } from "./question.entity";
import { GenerationRun } from "./generation-run.entity";
import type {
  AppExam,
  HistoricalAnalysisMode,
  PaperMode,
  PaperStatus,
  SubjectConfiguration,
  TargetExam,
  ClassLevel,
  HistoricalAnalysisSummary,
} from "../constants/domain";

@Entity({ name: "papers" })
export class Paper extends BaseEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.papers, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index("papers_title_idx")
  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  exam!: AppExam;

  @Column({ type: "text" })
  classLevel!: ClassLevel;

  @Column({ type: "text" })
  mode!: PaperMode;

  @Column({ type: "jsonb" })
  targetExams!: TargetExam[];

  @Column({ type: "jsonb" })
  subjectConfigurations!: SubjectConfiguration[];

  @Column({ type: "int" })
  questionCount!: number;

  @Column({ type: "text", default: "active" })
  status!: PaperStatus;

  @Column({ type: "text" })
  generationProvider!: string;

  @Column({ type: "text" })
  generationModel!: string;

  @Column({ type: "text" })
  promptVersion!: string;

  @Column({ type: "text" })
  historicalAnalysisMode!: HistoricalAnalysisMode;

  @Column({ type: "jsonb" })
  historicalAnalysisSummary!: HistoricalAnalysisSummary;

  @Column({ type: "jsonb" })
  validationSummary!: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  notes!: Record<string, unknown> | null;

  @OneToMany(() => Question, (question) => question.paper)
  questions!: Question[];

  @OneToMany(() => GenerationRun, (generationRun) => generationRun.paper)
  generationRuns!: GenerationRun[];
}
