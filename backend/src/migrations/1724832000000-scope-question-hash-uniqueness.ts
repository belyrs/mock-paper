import type { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeQuestionHashUniqueness1724832000000 implements MigrationInterface {
  name = "ScopeQuestionHashUniqueness1724832000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "questions_normalized_hash_unique"',
    );
    await queryRunner.query(
      'ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_normalizedHash_key"',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "questions_paper_normalized_hash_unique" ON "questions" ("paperId", "normalizedHash")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "questions_paper_normalized_hash_unique"',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "questions_normalized_hash_unique" ON "questions" ("normalizedHash")',
    );
  }
}
