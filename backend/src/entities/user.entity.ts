import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Paper } from "./paper.entity";
import { PasswordResetToken } from "./password-reset-token.entity";
import type { UserRole } from "../constants/domain";

@Entity({ name: "users" })
export class User extends BaseEntity {
  @Column({ type: "text" })
  name!: string;

  @Index("users_email_unique", { unique: true })
  @Column({ type: "text" })
  email!: string;

  @Column({ type: "text" })
  passwordHash!: string;

  @Column({ type: "text", default: "user" })
  role!: UserRole;

  @OneToMany(() => Paper, (paper) => paper.user)
  papers!: Paper[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  resetTokens!: PasswordResetToken[];
}
