import { UserRepository } from '../../domain/ports/UserRepository';
import { normalizeEmail } from '../../domain/value-objects/Email';
import { verifyPassword } from '../../infrastructure/security/password';
import { InvalidCredentials } from '../errors/InvalidCredentials';

export class LoginUser {
  constructor(private repo: UserRepository) {}

  async execute(input: { email: string; password: string }, deps: { signToken: (payload: any) => string }) {
    const email = normalizeEmail(input.email);
    const user = await this.repo.findByEmail(email);
    if (!user) throw new InvalidCredentials();

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new InvalidCredentials();

    const token = deps.signToken({ sub: user.id, email: user.email });
    return { token };
  }
}