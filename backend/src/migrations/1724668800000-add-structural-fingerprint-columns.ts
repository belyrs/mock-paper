import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStructuralFingerprintColumns1724668800000 implements MigrationInterface {
  name = "AddStructuralFingerprintColumns1724668800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS "structuralFingerprint" text;
    `);

    await queryRunner.query(`
      UPDATE questions
      SET "structuralFingerprint" = COALESCE("normalizedHash", md5(COALESCE(text, '')))
      WHERE "structuralFingerprint" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE questions
      ALTER COLUMN "structuralFingerprint" SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS questions_structural_fingerprint_idx
      ON questions ("structuralFingerprint");
    `);

    await queryRunner.query(`
      ALTER TABLE historical_questions
      ADD COLUMN IF NOT EXISTS "structuralFingerprint" text;
    `);

    await queryRunner.query(`
      UPDATE historical_questions
      SET "structuralFingerprint" = COALESCE("normalizedHash", md5(COALESCE(text, '')))
      WHERE "structuralFingerprint" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE historical_questions
      ALTER COLUMN "structuralFingerprint" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE historical_questions
      ADD COLUMN IF NOT EXISTS "semanticEmbedding" jsonb;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS historical_questions_structural_fingerprint_idx
      ON historical_questions ("structuralFingerprint");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS historical_questions_structural_fingerprint_idx;
    `);

    await queryRunner.query(`
      ALTER TABLE historical_questions
      DROP COLUMN IF EXISTS "semanticEmbedding";
    `);

    await queryRunner.query(`
      ALTER TABLE historical_questions
      DROP COLUMN IF EXISTS "structuralFingerprint";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS questions_structural_fingerprint_idx;
    `);

    await queryRunner.query(`
      ALTER TABLE questions
      DROP COLUMN IF EXISTS "structuralFingerprint";
    `);
  }
}
