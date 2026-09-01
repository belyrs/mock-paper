import { IsNull, type DataSource, type Repository } from "typeorm";
import { PasswordResetToken } from "../entities/password-reset-token.entity";

export class PasswordResetTokenRepository {
  private readonly repository: Repository<PasswordResetToken>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(PasswordResetToken);
  }

  create(payload: Partial<PasswordResetToken>) {
    return this.repository.create(payload);
  }

  save(token: PasswordResetToken) {
    return this.repository.save(token);
  }

  async consumeAllForUser(userId: string) {
    await this.repository.update({ userId, consumedAt: IsNull() }, { consumedAt: new Date() });
  }

  findValidByHash(tokenHash: string) {
    return this.repository.findOne({
      where: { tokenHash, consumedAt: IsNull() },
      relations: { user: true },
    });
  }
}
