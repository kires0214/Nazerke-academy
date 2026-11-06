import { checkDevReadiness } from './dev-readiness';
import { withDb } from '../src/lib/db';

const result=await checkDevReadiness(process.env,{
  live:process.argv.includes('--live'),
  databaseProbe:()=>withDb(async db=>{
    const {rows}=await db.query<{schema_ready:boolean}>(`SELECT to_regclass('public.schema_migrations') IS NOT NULL
      AND to_regclass('public.users') IS NOT NULL AND to_regclass('public.content') IS NOT NULL AS schema_ready`);
    return {schemaReady:rows[0].schema_ready};
  }),
});
console.log(JSON.stringify(result,null,2));
console.log('Read-only DEV diagnostics. No migrations, webhook changes, notifications, uploads or deployments were performed.');
console.log(result.mode==='configuration-only'?'Provider credentials were not contacted or authenticated.':'Read access and webhook target checks do not verify upload permission, webhook secret delivery, browser login or the full pilot flow.');
process.exitCode=result.status==='PASS'?0:result.status==='BLOCKED'?2:1;
