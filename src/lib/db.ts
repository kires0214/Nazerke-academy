import { Client } from 'pg';
import { AppError, check } from './errors';

export interface Db {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

// One bounded connection per operation. No idle pool or background database worker.
export async function withDb<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new AppError(503, 'DATABASE_NOT_CONFIGURED');
  const url = new URL(connectionString);
  check(url.hostname.endsWith('.neon.tech'), 503, 'NEON_DATABASE_REQUIRED');
  check(process.env.APP_ENV === 'DEV' || process.env.APP_ENV === 'PROD', 503, 'APP_ENV_REQUIRED');
  // Do not allow connection-string SSL options to downgrade certificate checks.
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 8000,
    statement_timeout: 10000, query_timeout: 12000, application_name: 'juicy-academy' });
  try {
    await client.connect();
    return await transaction(client as Db, work);
  } finally { await client.end(); }
}

export async function transaction<T>(db: Db, work: (db: Db) => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try { const result = await work(db); await db.query('COMMIT'); return result; }
  catch (error) { await db.query('ROLLBACK'); throw error; }
}
