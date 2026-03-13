import { UserRepository } from '../../domain/ports/UserRepository';
import { NotFound } from '../errors/NotFound';

export class GetMe {
  constructor(private repo: UserRepository) {}

  async execute(input: { userId: string }) {
    const user = await this.repo.findById(input.userId);
    if (!user) throw new NotFound('User not found');

    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }
}