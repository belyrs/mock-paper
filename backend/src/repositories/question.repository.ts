import crypto from "node:crypto";
import type { DataSource, Repository } from "typeorm";
import { Question } from "../entities/question.entity";
import type { ClassLevel } from "../constants/domain";

export class QuestionRepository {
  private readonly repository: Repository<Question>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Question);
  }

  create(payload: Partial<Question>) {
    return this.repository.create({
      ...payload,
      id: payload.id ?? crypto.randomUUID(),
    });
  }

  saveMany(questions: Question[]) {
    return this.repository.save(
      questions.map((question) =>
        this.repository.create({
          ...question,
          id: question.id ?? crypto.randomUUID(),
        }),
      ),
    );
  }

  save(question: Question) {
    return this.repository.save(
      this.repository.create({
        ...question,
        id: question.id ?? crypto.randomUUID(),
      }),
    );
  }

  async updateSemanticArtifacts(
    payload: Array<{ id: string; semanticEmbedding?: number[] | null }>,
  ) {
    await Promise.all(
      payload.map((item) =>
        this.repository.update(item.id, {
          semanticEmbedding: item.semanticEmbedding ?? null,
        }),
      ),
    );
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: { paper: true },
    });
  }

  findRelevantForDeduplication(payload: {
    subject: string;
    classLevel: ClassLevel;
    chapterNormalized: string;
    subTopicNormalized: string;
    excludePaperId?: string;
    limit?: number;
  }) {
    return this.repository
      .find({
        where: {
          subject: payload.subject,
          classLevel: payload.classLevel,
          chapterNormalized: payload.chapterNormalized,
          subTopicNormalized: payload.subTopicNormalized,
        },
        order: { createdAt: "DESC" },
        take: payload.limit ?? 40,
      })
      .then((questions) =>
        payload.excludePaperId
          ? questions.filter(
              (question) => question.paperId !== payload.excludePaperId,
            )
          : questions,
      );
  }
}
