"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeQuestionHashUniqueness1724832000000 = void 0;
class ScopeQuestionHashUniqueness1724832000000 {
    name = "ScopeQuestionHashUniqueness1724832000000";
    async up(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS "questions_normalized_hash_unique"');
        await queryRunner.query('ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_normalizedHash_key"');
        await queryRunner.query('CREATE UNIQUE INDEX "questions_paper_normalized_hash_unique" ON "questions" ("paperId", "normalizedHash")');
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS "questions_paper_normalized_hash_unique"');
        await queryRunner.query('CREATE UNIQUE INDEX "questions_normalized_hash_unique" ON "questions" ("normalizedHash")');
    }
}
exports.ScopeQuestionHashUniqueness1724832000000 = ScopeQuestionHashUniqueness1724832000000;
//# sourceMappingURL=1724832000000-scope-question-hash-uniqueness.js.map