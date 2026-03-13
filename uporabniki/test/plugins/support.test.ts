import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import Support from '../../dist/plugins/support.js';

describe('Support plugin', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('works standalone', async () => {
    app = Fastify();
    await app.register(Support);
    await app.ready();

    expect(app.someSupport()).toBe('hugs');
  });
});
