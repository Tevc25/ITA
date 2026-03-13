import fp from 'fastify-plugin';
import { UserRepositorySqlite } from '../infrastructure/repositories/UserRepositoryDb';
import { RegisterUser } from '../application/use-case/RegisterUser';
import { LoginUser } from '../application/use-case/LoginUser';
import { GetMe } from '../application/use-case/GetMe';

export default fp(async (fastify) => {
  const repo = new UserRepositorySqlite(fastify.db);

  fastify.decorate('useCases', {
    registerUser: new RegisterUser(repo),
    loginUser: new LoginUser(repo),
    getMe: new GetMe(repo),
  });
});