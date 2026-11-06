import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkDevReadiness,inspectDevEnvironment,type DevEnvironment} from '../scripts/dev-readiness';

function syntheticEnvironment():DevEnvironment {
  const database=new URL('postgresql://fixture.neon.tech/dev');database.username='synthetic-dev';database.password='not-a-real-credential';
  return {APP_ENV:'DEV',APP_BASE_URL:'https://dev.juicy.invalid',DATABASE_URL:database.toString(),
    TELEGRAM_BOT_TOKEN:'999999999:synthetic_dev_fixture_token_only',TELEGRAM_LOGIN_BOT_NAME:'JuicyDevFixtureBot',
    TELEGRAM_WEBHOOK_SECRET:'synthetic_webhook_fixture_'.padEnd(64,'x'),TELEGRAM_SUPPORT_CHAT_ID:'-900000000000001',
    CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_STREAM_API_TOKEN:'synthetic_dev_stream_token_only'};
}
const fetcher:typeof fetch=async(url)=>{
  if(String(url).endsWith('/getMe'))return Response.json({ok:true,result:{is_bot:true,username:'JuicyDevFixtureBot'}});
  if(String(url).endsWith('/getWebhookInfo'))return Response.json({ok:true,result:{url:'https://dev.juicy.invalid/api/telegram/webhook'}});
  return Response.json({success:true,result:[]});
};
test('missing DEV configuration is BLOCKED and contacts no providers',async()=>{
  let requests=0;const result=await checkDevReadiness({}, {live:true,fetcher:async()=>{requests++;throw new Error('must not run');},databaseProbe:async()=>{requests++;return {schemaReady:true};}});
  assert.equal(result.status,'BLOCKED');assert.equal(requests,0);assert.ok(result.checks.some(c=>c.name==='DATABASE_URL'&&c.code==='MISSING'));
});
test('PROD origins, Production targets, wrong Preview branch and public secret prefixes deny all live probes',async()=>{
  for(const overrides of [{APP_ENV:'PROD'},{VERCEL_ENV:'production'},{APP_BASE_URL:'https://nazerke-academy-demo.vercel.app'},
    {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'main'},{NEXT_PUBLIC_TELEGRAM_BOT_TOKEN:'synthetic_public_secret'}]) {
    let requests=0;const result=await checkDevReadiness({...syntheticEnvironment(),...overrides},{live:true,
      fetcher:async()=>{requests++;return Response.json({});},databaseProbe:async()=>{requests++;return {schemaReady:true};}});
    assert.equal(result.status,'FAIL');assert.equal(requests,0);
  }
});
test('read-only DEV probes verify schema, expected bot, webhook target and Stream read access',async()=>{
  const env=syntheticEnvironment(),result=await checkDevReadiness(env,{live:true,fetcher,databaseProbe:async()=>({schemaReady:true})});
  assert.equal(result.status,'PASS');assert.ok(result.checks.some(c=>c.name==='NEON_SCHEMA'&&c.status==='PASS'));
  const output=JSON.stringify(result);for(const key of ['DATABASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','CLOUDFLARE_STREAM_API_TOKEN'])assert.equal(output.includes(env[key]!),false);
});
test('provider errors never expose request URLs, credentials or provider response bodies',async()=>{
  const env=syntheticEnvironment();const result=await checkDevReadiness(env,{live:true,
    fetcher:async()=>{throw new Error('sensitive provider detail '+env.TELEGRAM_BOT_TOKEN);},
    databaseProbe:async()=>{throw new Error('sensitive database detail '+env.DATABASE_URL);}});
  assert.equal(result.status,'FAIL');assert.equal(JSON.stringify(result).includes('sensitive'),false);assert.equal(JSON.stringify(result).includes(env.TELEGRAM_BOT_TOKEN!),false);
  const denied=await checkDevReadiness(env,{live:true,fetcher:async()=>Response.json({error:env.CLOUDFLARE_STREAM_API_TOKEN},{status:403}),databaseProbe:async()=>({schemaReady:true})});
  assert.ok(denied.checks.some(c=>c.code==='PROVIDER_HTTP_403'));assert.equal(JSON.stringify(denied).includes(env.CLOUDFLARE_STREAM_API_TOKEN!),false);
});
test('an available Neon connection can be checked independently while missing providers stay BLOCKED',async()=>{
  const env=syntheticEnvironment();delete env.TELEGRAM_BOT_TOKEN;delete env.CLOUDFLARE_STREAM_API_TOKEN;
  let calls=0;const result=await checkDevReadiness(env,{live:true,fetcher:async()=>{throw new Error('must not run');},databaseProbe:async()=>{calls++;return {schemaReady:false};}});
  assert.equal(calls,1);assert.equal(result.status,'BLOCKED');assert.ok(result.checks.some(c=>c.name==='NEON_CONNECTION'&&c.status==='PASS'));assert.ok(result.checks.some(c=>c.name==='NEON_SCHEMA'&&c.code==='MIGRATIONS_REQUIRED'));
});
test('wrong Telegram bot identity and an existing Production webhook are rejected',async()=>{
  const env=syntheticEnvironment();const wrong=await checkDevReadiness(env,{live:true,databaseProbe:async()=>({schemaReady:true}),fetcher:async url=>
    String(url).endsWith('/getMe')?Response.json({ok:true,result:{is_bot:true,username:'DifferentFixtureBot'}}):fetcher(url)});
  assert.ok(wrong.checks.some(c=>c.code==='BOT_IDENTITY_MISMATCH'));
  const production=await checkDevReadiness(env,{live:true,databaseProbe:async()=>({schemaReady:true}),fetcher:async url=>
    String(url).endsWith('/getWebhookInfo')?Response.json({ok:true,result:{url:'https://nazerke.academy/api/telegram/webhook'}}):fetcher(url)});
  assert.ok(production.checks.some(c=>c.code==='PRODUCTION_WEBHOOK_DENIED'));
});
test('local DEV config is valid but cannot be mistaken for a public Telegram webhook',async()=>{
  const env={...syntheticEnvironment(),APP_BASE_URL:'http://localhost:3000'};
  assert.equal(inspectDevEnvironment(env).every(c=>c.status==='PASS'),true);
  const result=await checkDevReadiness(env,{live:true,fetcher,databaseProbe:async()=>({schemaReady:true})});
  assert.equal(result.status,'BLOCKED');assert.ok(result.checks.some(c=>c.code==='PUBLIC_DEV_ORIGIN_REQUIRED'));
});
