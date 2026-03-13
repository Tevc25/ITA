import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    (request as any).requestStartAt = Date.now();
    request.log.info({ method: request.method, url: request.url }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const requestStartAt = (request as any).requestStartAt ?? Date.now();
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        elapsedMs: Date.now() - requestStartAt
      },
      'Request completed'
    );
  });
});
