import { UserRepository } from '../../domain/ports/UserRepository';
import { User } from '../../domain/entities/User';
import { Db } from '../db/client';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

export class UserRepositorySqlite implements UserRepository {
  constructor(private db: Db) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare<[string], UserRow>(`SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?`)
      .get(email);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      createdAt: new Date(row.created_at),
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db
      .prepare<[string], UserRow>(`SELECT id, email, password_hash, name, created_at FROM users WHERE id = ?`)
      .get(id);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      createdAt: new Date(row.created_at),
    };
  }

  async save(user: User): Promise<void> {
    this.db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.createdAt.toISOString()
    );
  }
}
