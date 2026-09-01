"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetTokenRepository = void 0;
const typeorm_1 = require("typeorm");
const password_reset_token_entity_1 = require("../entities/password-reset-token.entity");
class PasswordResetTokenRepository {
    repository;
    constructor(dataSource) {
        this.repository = dataSource.getRepository(password_reset_token_entity_1.PasswordResetToken);
    }
    create(payload) {
        return this.repository.create(payload);
    }
    save(token) {
        return this.repository.save(token);
    }
    async consumeAllForUser(userId) {
        await this.repository.update({ userId, consumedAt: (0, typeorm_1.IsNull)() }, { consumedAt: new Date() });
    }
    findValidByHash(tokenHash) {
        return this.repository.findOne({
            where: { tokenHash, consumedAt: (0, typeorm_1.IsNull)() },
            relations: { user: true },
        });
    }
}
exports.PasswordResetTokenRepository = PasswordResetTokenRepository;
//# sourceMappingURL=password-reset-token.repository.js.map