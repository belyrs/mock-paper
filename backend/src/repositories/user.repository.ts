import type { DataSource, Repository } from "typeorm";
import { User } from "../entities/user.entity";

export class UserRepository {
  private readonly repository: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(User);
  }

  count() {
    return this.repository.count();
  }

  findByEmail(email: string) {
    return this.repository.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repository.findOne({ where: { id } });
  }

  save(user: Partial<User>) {
    return this.repository.save(this.repository.create(user));
  }

  update(user: User) {
    return this.repository.save(user);
  }
}
