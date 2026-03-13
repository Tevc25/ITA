import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env'), quiet: true });

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is not set') })(),
  sqlitePath: process.env.SQLITE_PATH ?? './data/users.sqlite'
};
