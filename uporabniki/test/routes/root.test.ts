import { afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helper';

describe('System endpoints', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns service health on GET /', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'uporabniki' });
  });

  it('exposes OpenAPI JSON on GET /docs/json', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeTruthy();
    expect(body.info.title).toBe('Uporabniki API');
  });
});
