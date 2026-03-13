import { FastifyPluginAsync } from 'fastify';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register user',
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any;
      const result = await fastify.useCases.registerUser.execute(body);
      return reply.code(201).send(result);
    },
  });

  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any;
      const result = await fastify.useCases.loginUser.execute(body, {
        signToken: (payload: { sub: string; email: string }) => fastify.jwt.sign(payload, { expiresIn: '2h' }),
      });
      return reply.send(result);
    },
  });
};

export default authRoutes;
