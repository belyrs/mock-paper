"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationRunRepository = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const generation_run_entity_1 = require("../entities/generation-run.entity");
class GenerationRunRepository {
    repository;
    constructor(dataSource) {
        this.repository = dataSource.getRepository(generation_run_entity_1.GenerationRun);
    }
    create(payload) {
        return this.repository.create({
            ...payload,
            id: payload.id ?? node_crypto_1.default.randomUUID(),
        });
    }
    saveMany(items) {
        return this.repository.save(items.map((item) => this.repository.create({
            ...item,
            id: item.id ?? node_crypto_1.default.randomUUID(),
        })));
    }
}
exports.GenerationRunRepository = GenerationRunRepository;
//# sourceMappingURL=generation-run.repository.js.map