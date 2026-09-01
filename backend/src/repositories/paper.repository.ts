import type { DataSource, FindManyOptions, Repository } from "typeorm";
import { Paper } from "../entities/paper.entity";

export class PaperRepository {
  private readonly repository: Repository<Paper>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Paper);
  }

  create(payload: Partial<Paper>) {
    return this.repository.create(payload);
  }

  save(paper: Paper) {
    return this.repository.save(paper);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: { questions: true },
      order: { questions: { position: "ASC" } },
    });
  }

  findActiveByIdForUser(id: string, userId: string) {
    return this.repository.findOne({
      where: { id, userId, status: "active" },
      relations: { questions: true },
      order: { questions: { position: "ASC" } },
    });
  }

  findAllActiveForUser(userId: string) {
    const options: FindManyOptions<Paper> = {
      where: { userId, status: "active" },
      relations: { questions: true },
      order: { createdAt: "DESC", questions: { position: "ASC" } },
    };

    return this.repository.find(options);
  }
}
