import { afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helper';

describe('Auth and Me endpoints', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers a new user on POST /auth/register', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'secret12',
        name: 'Test User',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toEqual(expect.any(String));
    expect(body.email).toBe('test@example.com');
    expect(body.name).toBe('Test User');
    expect(body.createdAt).toBeTruthy();
  });

  it('returns 409 on duplicate registration', async () => {
    app = await buildApp();

    const payload = {
      email: 'dupe@example.com',
      password: 'secret12',
      name: 'Dupe User',
    };

    await app.inject({ method: 'POST', url: '/auth/register', payload });
    const duplicate = await app.inject({ method: 'POST', url: '/auth/register', payload });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().message).toBe('User with this email already exists');
  });

  it('logs in and returns JWT on POST /auth/login', async () => {
    app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'login@example.com', password: 'secret12', name: 'Login User' },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@example.com', password: 'secret12' },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().token).toEqual(expect.any(String));
  });

  it('returns 401 for invalid credentials on POST /auth/login', async () => {
    app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'badpass@example.com', password: 'secret12', name: 'Bad Pass' },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'badpass@example.com', password: 'wrong-password' },
    });

    expect(login.statusCode).toBe(401);
    expect(login.json().message).toBe('Invalid credentials');
  });

  it('returns 401 for GET /me without JWT', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/me' });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe('Unauthorized');
  });

  it('returns current user for GET /me with JWT', async () => {
    app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'me@example.com', password: 'secret12', name: 'Me User' },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'me@example.com', password: 'secret12' },
    });

    const token = login.json().token;
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.email).toBe('me@example.com');
    expect(body.name).toBe('Me User');
    expect(body.id).toEqual(expect.any(String));
  });
});
