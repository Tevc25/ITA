import { FastifyPluginAsync } from 'fastify';

const root: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      tags: ['system'],
      summary: 'Healthcheck',
    },
  }, async () => ({ status: 'ok', service: 'uporabniki' }));
};

export default root;
