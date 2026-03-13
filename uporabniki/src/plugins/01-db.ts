import fp from 'fastify-plugin';
import { openDb, migrate } from '../infrastructure/db/client';

export default fp(async (fastify) => {
  const db = openDb();
  migrate(db);

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    db.close();
  });
});