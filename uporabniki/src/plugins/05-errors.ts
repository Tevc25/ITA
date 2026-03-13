import fp from 'fastify-plugin';
import { UserAlreadyExistsError } from '../domain/errors/UserAlreadyExistsError';
import { InvalidCredentials } from '../application/errors/InvalidCredentials';
import { NotFound } from '../application/errors/NotFound';

export default fp(async (fastify) => {
  fastify.setErrorHandler((err, request, reply) => {
    if ((err as any)?.validation) {
      return reply.code(400).send({ message: 'Validation error', details: (err as any).validation });
    }

    if (err instanceof UserAlreadyExistsError) return reply.code(409).send({ message: err.message });
    if (err instanceof InvalidCredentials) return reply.code(401).send({ message: err.message });
    if (err instanceof NotFound) return reply.code(404).send({ message: err.message });

    request.log.error({ err }, 'Unhandled error');
    return reply.code(500).send({ message: 'Internal Server Error' });
  });
});