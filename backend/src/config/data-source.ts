import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env";
import { GenerationRun } from "../entities/generation-run.entity";
import { HistoricalPaper } from "../entities/historical-paper.entity";
import { HistoricalQuestion } from "../entities/historical-question.entity";
import { Paper } from "../entities/paper.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { Question } from "../entities/question.entity";
import { User } from "../entities/user.entity";
import { InitSchema1724496000000 } from "../migrations/1724496000000-init-schema";
import { AddStructuralFingerprintColumns1724668800000 } from "../migrations/1724668800000-add-structural-fingerprint-columns";
import { ScopeQuestionHashUniqueness1724832000000 } from "../migrations/1724832000000-scope-question-hash-uniqueness";

export const buildDataSource = () =>
  new DataSource({
    type: "postgres",
    url: env.DATABASE_URL,
    synchronize: env.DATABASE_SYNCHRONIZE,
    logging: env.NODE_ENV === "development" ? ["error"] : false,
    entities: [
      User,
      PasswordResetToken,
      Paper,
      Question,
      GenerationRun,
      HistoricalPaper,
      HistoricalQuestion,
    ],
    migrations: [
      InitSchema1724496000000,
      AddStructuralFingerprintColumns1724668800000,
      ScopeQuestionHashUniqueness1724832000000,
    ],
    migrationsRun: false,
    ssl: env.DATABASE_SSL
      ? {
          rejectUnauthorized: false,
        }
      : false,
  });
