"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const env_1 = require("./env");
const generation_run_entity_1 = require("../entities/generation-run.entity");
const historical_paper_entity_1 = require("../entities/historical-paper.entity");
const historical_question_entity_1 = require("../entities/historical-question.entity");
const paper_entity_1 = require("../entities/paper.entity");
const password_reset_token_entity_1 = require("../entities/password-reset-token.entity");
const question_entity_1 = require("../entities/question.entity");
const user_entity_1 = require("../entities/user.entity");
const _1724496000000_init_schema_1 = require("../migrations/1724496000000-init-schema");
const _1724668800000_add_structural_fingerprint_columns_1 = require("../migrations/1724668800000-add-structural-fingerprint-columns");
const buildDataSource = () => new typeorm_1.DataSource({
    type: "postgres",
    url: env_1.env.DATABASE_URL,
    synchronize: env_1.env.DATABASE_SYNCHRONIZE,
    logging: env_1.env.NODE_ENV === "development" ? ["error"] : false,
    entities: [user_entity_1.User, password_reset_token_entity_1.PasswordResetToken, paper_entity_1.Paper, question_entity_1.Question, generation_run_entity_1.GenerationRun, historical_paper_entity_1.HistoricalPaper, historical_question_entity_1.HistoricalQuestion],
    migrations: [_1724496000000_init_schema_1.InitSchema1724496000000, _1724668800000_add_structural_fingerprint_columns_1.AddStructuralFingerprintColumns1724668800000],
    migrationsRun: false,
    ssl: env_1.env.DATABASE_SSL
        ? {
            rejectUnauthorized: false,
        }
        : false,
});
exports.buildDataSource = buildDataSource;
//# sourceMappingURL=data-source.js.map