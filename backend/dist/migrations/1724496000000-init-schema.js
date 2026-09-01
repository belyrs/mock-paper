"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitSchema1724496000000 = void 0;
class InitSchema1724496000000 {
    name = "InitSchema1724496000000";
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        "passwordHash" text NOT NULL,
        role text NOT NULL DEFAULT 'user'
      );
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "tokenHash" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "consumedAt" timestamptz
      );
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS papers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        title text NOT NULL,
        exam text NOT NULL,
        "classLevel" text NOT NULL,
        mode text NOT NULL,
        "targetExams" jsonb NOT NULL,
        "subjectConfigurations" jsonb NOT NULL,
        "questionCount" int NOT NULL,
        status text NOT NULL DEFAULT 'active',
        "generationProvider" text NOT NULL,
        "generationModel" text NOT NULL,
        "promptVersion" text NOT NULL,
        "historicalAnalysisMode" text NOT NULL,
        "historicalAnalysisSummary" jsonb NOT NULL,
        "validationSummary" jsonb NOT NULL,
        notes jsonb
      );
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS papers_title_idx ON papers(title);`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "paperId" uuid NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
        position int NOT NULL,
        subject text NOT NULL,
        "classLevel" text NOT NULL,
        chapter text NOT NULL,
        "chapterNormalized" text NOT NULL,
        "subTopic" text NOT NULL,
        "subTopicNormalized" text NOT NULL,
        "targetExams" jsonb NOT NULL,
        difficulty text NOT NULL,
        "questionType" text NOT NULL DEFAULT 'MCQ',
        text text NOT NULL,
        "normalizedText" text NOT NULL,
        "normalizedHash" text NOT NULL UNIQUE,
        "structuralFingerprint" text NOT NULL,
        options jsonb NOT NULL,
        "correctOption" text NOT NULL,
        "correctIndex" int NOT NULL,
        "conceptTested" text NOT NULL,
        "commonMistake" text NOT NULL,
        "recommendedRemedialAction" text NOT NULL,
        "learningOutcome" text NOT NULL,
        "bloomsTaxonomyLevel" text NOT NULL,
        "examRelevance" jsonb NOT NULL,
        "sourceReference" text,
        "generationProvider" text NOT NULL,
        "generationModel" text NOT NULL,
        "promptVersion" text NOT NULL,
        "semanticEmbedding" jsonb,
        metadata jsonb
      );
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS questions_subject_idx ON questions(subject);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS questions_chapter_normalized_idx ON questions("chapterNormalized");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS questions_sub_topic_normalized_idx ON questions("subTopicNormalized");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS questions_structural_fingerprint_idx ON questions("structuralFingerprint");`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS generation_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "paperId" uuid NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
        status text NOT NULL,
        provider text NOT NULL,
        model text NOT NULL,
        "promptVersion" text NOT NULL,
        "requestPayload" jsonb NOT NULL,
        "responsePayload" jsonb NOT NULL,
        "validationReport" jsonb NOT NULL,
        "failureReason" text
      );
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS historical_papers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        exam text NOT NULL,
        year int NOT NULL,
        subject text NOT NULL,
        "classLevel" text,
        "sourceLabel" text NOT NULL,
        "sourceUrl" text,
        metadata jsonb
      );
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS historical_questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "paperId" uuid NOT NULL REFERENCES historical_papers(id) ON DELETE CASCADE,
        "questionNumber" int NOT NULL,
        subject text NOT NULL,
        chapter text NOT NULL,
        "chapterNormalized" text NOT NULL,
        "subTopic" text NOT NULL,
        "subTopicNormalized" text NOT NULL,
        text text NOT NULL,
        "normalizedText" text NOT NULL,
        "normalizedHash" text NOT NULL,
        "structuralFingerprint" text NOT NULL,
        options jsonb,
        "correctOption" text,
        "conceptTags" jsonb,
        "semanticEmbedding" jsonb,
        metadata jsonb
      );
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS historical_questions_normalized_hash_idx ON historical_questions("normalizedHash");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS historical_questions_structural_fingerprint_idx ON historical_questions("structuralFingerprint");`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS historical_questions;`);
        await queryRunner.query(`DROP TABLE IF EXISTS historical_papers;`);
        await queryRunner.query(`DROP TABLE IF EXISTS generation_runs;`);
        await queryRunner.query(`DROP TABLE IF EXISTS questions;`);
        await queryRunner.query(`DROP TABLE IF EXISTS papers;`);
        await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens;`);
        await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    }
}
exports.InitSchema1724496000000 = InitSchema1724496000000;
//# sourceMappingURL=1724496000000-init-schema.js.map