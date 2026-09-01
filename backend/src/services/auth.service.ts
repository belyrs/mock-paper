import { AppError } from "../errors/app-error";
import { UserRepository } from "../repositories/user.repository";
import { hashPassword, verifyPassword } from "../utils/auth";
import type { LoginInput, RegisterInput } from "../dtos/auth.dto";
import { env } from "../config/env";

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(input: RegisterInput) {
    const existing = await this.userRepository.findByEmail(input.email);

    if (existing) {
      throw new AppError(409, "EMAIL_ALREADY_IN_USE", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const userCount = await this.userRepository.count();
    const isAdmin =
      userCount === 0 || (env.DEFAULT_ADMIN_EMAIL && env.DEFAULT_ADMIN_EMAIL === input.email);

    return this.userRepository.save({
      name: input.name,
      email: input.email,
      passwordHash,
      role: isAdmin ? "admin" : "user",
    });
  }

  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    return user;
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(401, "USER_NOT_FOUND", "The signed-in account could not be found.");
    }

    return user;
  }
}
