import { FastifyPluginAsync } from 'fastify';

const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['me'],
      summary: 'Get authenticated user profile',
      security: [{ BearerAuth: [] }],
    },
  }, async (request: any, reply) => {
    const result = await fastify.useCases.getMe.execute({ userId: request.authUser.id });
    return reply.send(result);
  });
};

export default meRoutes;
