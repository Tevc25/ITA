import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../dist/infrastructure/db/client.js';
import { UserRepositorySqlite } from '../../dist/infrastructure/repositories/UserRepositoryDb.js';

describe('UserRepositorySqlite', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('saves user and finds by email and id', async () => {
    db = new Database(':memory:');
    migrate(db);
    const repo = new UserRepositorySqlite(db);

    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const user = {
      id: 'user-1',
      email: 'repo@example.com',
      passwordHash: 'hash123',
      name: 'Repo User',
      createdAt,
    };

    await repo.save(user);

    const byEmail = await repo.findByEmail('repo@example.com');
    const byId = await repo.findById('user-1');

    expect(byEmail).toEqual(user);
    expect(byId).toEqual(user);
  });

  it('returns null when user does not exist', async () => {
    db = new Database(':memory:');
    migrate(db);
    const repo = new UserRepositorySqlite(db);

    expect(await repo.findByEmail('missing@example.com')).toBeNull();
    expect(await repo.findById('missing-id')).toBeNull();
  });
});
