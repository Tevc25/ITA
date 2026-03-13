import { randomUUID } from 'node:crypto';
import { UserRepository } from '../../domain/ports/UserRepository';
import { normalizeEmail } from '../../domain/value-objects/Email';
import { UserAlreadyExistsError } from '../../domain/errors/UserAlreadyExistsError';
import { hashPassword } from '../../infrastructure/security/password';

export class RegisterUser {
  constructor(private repo: UserRepository) {}

  async execute(input: { email: string; password: string; name: string }) {
    const email = normalizeEmail(input.email);

    const existing = await this.repo.findByEmail(email);
    if (existing) throw new UserAlreadyExistsError();

    const passwordHash = await hashPassword(input.password);

    const user = {
      id: randomUUID(),
      email,
      passwordHash,
      name: input.name.trim(),
      createdAt: new Date(),
    };

    try {
      await this.repo.save(user);
    } catch (e: any) {
      if (String(e?.message ?? '').toLowerCase().includes('unique')) {
        throw new UserAlreadyExistsError();
      }
      throw e;
    }

    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }
}