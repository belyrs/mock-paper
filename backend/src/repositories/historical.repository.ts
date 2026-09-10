import crypto from "node:crypto";
import type { DataSource, Repository } from "typeorm";
import { HistoricalPaper } from "../entities/historical-paper.entity";
import { HistoricalQuestion } from "../entities/historical-question.entity";

export class HistoricalRepository {
  private readonly paperRepository: Repository<HistoricalPaper>;
  private readonly questionRepository: Repository<HistoricalQuestion>;

  constructor(dataSource: DataSource) {
    this.paperRepository = dataSource.getRepository(HistoricalPaper);
    this.questionRepository = dataSource.getRepository(HistoricalQuestion);
  }

  createPaper(payload: Partial<HistoricalPaper>) {
    return this.paperRepository.create({
      ...payload,
      id: payload.id ?? crypto.randomUUID(),
    });
  }

  savePaper(paper: HistoricalPaper) {
    return this.paperRepository.save(
      this.paperRepository.create({
        ...paper,
        id: paper.id ?? crypto.randomUUID(),
      }),
    );
  }

  createQuestion(payload: Partial<HistoricalQuestion>) {
    return this.questionRepository.create({
      ...payload,
      id: payload.id ?? crypto.randomUUID(),
    });
  }

  saveQuestions(questions: HistoricalQuestion[]) {
    return this.questionRepository.save(
      questions.map((question) =>
        this.questionRepository.create({
          ...question,
          id: question.id ?? crypto.randomUUID(),
        }),
      ),
    );
  }

  async updateSemanticArtifacts(
    payload: Array<{ id: string; semanticEmbedding?: number[] | null }>,
  ) {
    await Promise.all(
      payload.map((item) =>
        this.questionRepository.update(item.id, {
          semanticEmbedding: item.semanticEmbedding ?? null,
        }),
      ),
    );
  }

  countQuestions() {
    return this.questionRepository.count();
  }

  findRelevantQuestions(payload: {
    subject: string;
    chapterNormalized: string;
    subTopicNormalized: string;
  }) {
    return this.questionRepository.find({
      where: {
        subject: payload.subject,
        chapterNormalized: payload.chapterNormalized,
        subTopicNormalized: payload.subTopicNormalized,
      },
      relations: { paper: true },
      order: {
        paper: { year: "DESC" },
        questionNumber: "ASC",
      },
      take: 40,
    });
  }
}
