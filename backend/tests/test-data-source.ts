import crypto from "node:crypto";
import { DataType, newDb } from "pg-mem";
import type { DataSource } from "typeorm";
import { GenerationRun } from "../src/entities/generation-run.entity";
import { HistoricalPaper } from "../src/entities/historical-paper.entity";
import { HistoricalQuestion } from "../src/entities/historical-question.entity";
import { Paper } from "../src/entities/paper.entity";
import { PasswordResetToken } from "../src/entities/password-reset-token.entity";
import { Question } from "../src/entities/question.entity";
import { User } from "../src/entities/user.entity";

export async function createTestDataSource(): Promise<DataSource> {
  const database = newDb({ autoCreateForeignKeyIndices: true });

  database.public.registerFunction({
    name: "current_database",
    returns: DataType.text,
    implementation: () => "mockpaper_test",
  });

  database.public.registerFunction({
    name: "version",
    returns: DataType.text,
    implementation: () => "pg-mem",
  });

  database.registerExtension("pgcrypto", (schema) => {
    schema.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });
  });

  database.public.registerFunction({
    name: "uuid_generate_v4",
    returns: DataType.uuid,
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  const dataSource = await database.adapters.createTypeormDataSource({
    type: "postgres",
    entities: [
      User,
      PasswordResetToken,
      Paper,
      Question,
      GenerationRun,
      HistoricalPaper,
      HistoricalQuestion,
    ],
    synchronize: true,
  });

  await dataSource.initialize();
  return dataSource;
}
