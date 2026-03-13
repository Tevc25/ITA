import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      const payload: any = request.user;
      request.authUser = { id: payload.sub, email: payload.email };
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
  });
});