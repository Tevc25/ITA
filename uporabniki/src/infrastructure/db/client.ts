import Database from 'better-sqlite3';
import { env } from '../../config/env';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

export function openDb(): Db {
  const dir = path.dirname(env.sqlitePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(env.sqlitePath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}