import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withDb,type Db } from '../src/lib/db';
import { check } from '../src/lib/errors';
export async function migrate(db:Db) {
  await db.query('SELECT pg_advisory_xact_lock(719481031)');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()) {
    const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'),sha=createHash('sha256').update(sql).digest('hex');
    const prior=(await db.query<{sha256:string}>('SELECT sha256 FROM schema_migrations WHERE name=$1',[name])).rows[0];
    if(prior) {check(prior.sha256===sha,409,'MIGRATION_CHECKSUM_CHANGED');continue;}
    await db.query(sql);await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,sha]);
  }
}
if(process.argv[1]?.endsWith('migrate.ts')) {await withDb(migrate);console.log('PASS: PostgreSQL migrations applied');}
