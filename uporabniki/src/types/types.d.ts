import 'fastify';
import type Database from 'better-sqlite3';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
    useCases: {
      registerUser: { execute: (input: any) => Promise<any> };
      loginUser: { execute: (input: any, deps: any) => Promise<any> };
      getMe: { execute: (input: any) => Promise<any> };
    };
    authenticate: any;
  }

  interface FastifyRequest {
    authUser?: { id: string; email: string };
  }
}