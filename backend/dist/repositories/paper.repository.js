"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperRepository = void 0;
const paper_entity_1 = require("../entities/paper.entity");
class PaperRepository {
    repository;
    constructor(dataSource) {
        this.repository = dataSource.getRepository(paper_entity_1.Paper);
    }
    create(payload) {
        return this.repository.create(payload);
    }
    save(paper) {
        return this.repository.save(paper);
    }
    findById(id) {
        return this.repository.findOne({
            where: { id },
            relations: { questions: true },
            order: { questions: { position: "ASC" } },
        });
    }
    findActiveByIdForUser(id, userId) {
        return this.repository.findOne({
            where: { id, userId, status: "active" },
            relations: { questions: true },
            order: { questions: { position: "ASC" } },
        });
    }
    findAllActiveForUser(userId) {
        const options = {
            where: { userId, status: "active" },
            relations: { questions: true },
            order: { createdAt: "DESC", questions: { position: "ASC" } },
        };
        return this.repository.find(options);
    }
}
exports.PaperRepository = PaperRepository;
//# sourceMappingURL=paper.repository.js.map