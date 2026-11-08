import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import type { Db } from '../src/lib/db';
import { createLogin,principal,hash,type Principal,type Tokens } from '../src/lib/security';
import { seedDev } from '../scripts/seed';
import { migrate } from '../scripts/migrate';

export function adapter(engine:Pick<PGlite,'query'|'exec'>):Db {
  return {async query<T extends Record<string,unknown>>(sql:string,params?:unknown[]) {
    if(!params&&sql.includes(';')) {const result=await engine.exec(sql);return {rows:(result.at(-1)?.rows??[]) as T[]};}
    const result=await engine.query(sql,params);return {rows:result.rows as T[]};
  }};
}
export async function fixture() {
  const engine=new PGlite();
  await engine.transaction(tx=>migrate(adapter(tx as unknown as PGlite)));
  const run=<T>(work:(db:Db)=>Promise<T>)=>engine.transaction(tx=>work(adapter(tx as unknown as PGlite)));
  let number=900000000000000;
  async function account(role='student',status='approved',scopes=['academy'],permissions:string[]=[]) {
    const telegramId=String(++number);
    const login=await run(db=>createLogin(db,{telegramId,name:'Synthetic DEV',receipt:hash(randomUUID())}));
    const tokens:Tokens={session:login.sessionToken,device:login.deviceToken};
    const id=(await engine.query<{id:string}>('UPDATE users SET role=$2,status=$3 WHERE telegram_id=$1 RETURNING id',[telegramId,role,status])).rows[0].id;
    for(const scope of scopes)await engine.query('INSERT INTO access_entitlements(user_id,scope) VALUES($1,$2)',[id,scope]);
    for(const permission of permissions)await engine.query('INSERT INTO admin_grants(user_id,permission,granted_by) VALUES($1,$2,$1)',[id,permission]);
    const p=await run(db=>principal(db,tokens,true));return {id,telegramId,tokens,p};
  }
  await run(seedDev);
  return {engine,run,account,close:()=>engine.close()};
}
export function syntheticPrincipal(role:Principal['role'],permissions:string[]=[],scopes:string[]=['academy']):Principal {
  return {id:randomUUID(),display_name:'Synthetic DEV',status:'approved',role,grants:permissions,scopes};
}
