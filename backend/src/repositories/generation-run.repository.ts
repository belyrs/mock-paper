import crypto from "node:crypto";
import type { DataSource, Repository } from "typeorm";
import { GenerationRun } from "../entities/generation-run.entity";

export class GenerationRunRepository {
  private readonly repository: Repository<GenerationRun>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(GenerationRun);
  }

  create(payload: Partial<GenerationRun>) {
    return this.repository.create({
      ...payload,
      id: payload.id ?? crypto.randomUUID(),
    });
  }

  saveMany(items: GenerationRun[]) {
    return this.repository.save(
      items.map((item) =>
        this.repository.create({
          ...item,
          id: item.id ?? crypto.randomUUID(),
        }),
      ),
    );
  }
}
