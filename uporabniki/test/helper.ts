import Fastify, { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.SQLITE_PATH = ':memory:';

export async function buildApp(): Promise<FastifyInstance> {
  const { default: app } = await import('../dist/app.js');
  const fastify = Fastify({ logger: false });
  await fastify.register(app);
  await fastify.ready();
  return fastify;
}
