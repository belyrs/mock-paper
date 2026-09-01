"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const user_entity_1 = require("../entities/user.entity");
class UserRepository {
    repository;
    constructor(dataSource) {
        this.repository = dataSource.getRepository(user_entity_1.User);
    }
    count() {
        return this.repository.count();
    }
    findByEmail(email) {
        return this.repository.findOne({ where: { email } });
    }
    findById(id) {
        return this.repository.findOne({ where: { id } });
    }
    save(user) {
        return this.repository.save(this.repository.create(user));
    }
    update(user) {
        return this.repository.save(user);
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user.repository.js.map