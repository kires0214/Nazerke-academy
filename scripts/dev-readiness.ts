// DEV-only diagnostics. Reports contain key names and fixed status codes, never values.
export type DevEnvironment=Record<string,string|undefined>;
export type SetupCheck={name:string;status:'PASS'|'BLOCKED'|'FAIL';code:string};
export const devKeys=['APP_ENV','APP_BASE_URL','DATABASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_LOGIN_BOT_NAME',
  'TELEGRAM_WEBHOOK_SECRET','TELEGRAM_SUPPORT_CHAT_ID','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_STREAM_API_TOKEN'] as const;
const productionHosts=new Set(['nazerke-academy-demo.vercel.app','nazerke-academy-demo-orch-loopers.vercel.app','nazerke.academy']);
const secretKeys=['DATABASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','CLOUDFLARE_STREAM_API_TOKEN'];
const outcome=(name:string,status:SetupCheck['status'],code:string):SetupCheck=>({name,status,code});
function origin(value:string) {
  try {const url=new URL(value);return !url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'?url:null;}catch{return null;}
}
function local(url:URL){return ['localhost','127.0.0.1','[::1]'].includes(url.hostname);}
const rules:Record<typeof devKeys[number],(value:string)=>boolean>={
  APP_ENV:value=>value==='DEV',
  APP_BASE_URL:value=>{const url=origin(value);return !!url&&!productionHosts.has(url.hostname)&&(url.protocol==='https:'||url.protocol==='http:'&&local(url));},
  DATABASE_URL:value=>{try{const url=new URL(value);return ['postgres:','postgresql:'].includes(url.protocol)&&url.hostname.endsWith('.neon.tech')&&!!url.username&&!!url.password;}catch{return false;}},
  TELEGRAM_BOT_TOKEN:value=>/^\d+:[A-Za-z0-9_-]{20,}$/.test(value),
  TELEGRAM_LOGIN_BOT_NAME:value=>/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value),
  TELEGRAM_WEBHOOK_SECRET:value=>/^[A-Za-z0-9_-]{32,256}$/.test(value),
  TELEGRAM_SUPPORT_CHAT_ID:value=>{if(!/^-?[1-9]\d{0,18}$/.test(value))return false;const id=BigInt(value);return id>=-(2n**63n)&&id<2n**63n;},
  CLOUDFLARE_ACCOUNT_ID:value=>/^[a-f0-9]{32}$/.test(value),
  CLOUDFLARE_STREAM_API_TOKEN:value=>value.length>=20&&!/\s/.test(value),
};
export function inspectDevEnvironment(env:DevEnvironment):SetupCheck[] {
  const checks=devKeys.map(name=>{const value=env[name];return !value?.trim()?outcome(name,'BLOCKED','MISSING'):
    outcome(name,value===value.trim()&&rules[name](value)?'PASS':'FAIL',value===value.trim()&&rules[name](value)?'FORMAT_VALID':'INVALID_DEV_VALUE');});
  checks.push(outcome('DEV_TARGET',env.VERCEL_ENV==='production'||env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF!=='codex/juicy-mvp'?'FAIL':'PASS',
    env.VERCEL_ENV==='production'?'PRODUCTION_TARGET_DENIED':env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF!=='codex/juicy-mvp'?'UNVERIFIED_PREVIEW_BRANCH':'DEV_TARGET_ALLOWED'));
  checks.push(outcome('SERVER_ONLY_SECRETS',secretKeys.some(key=>!!env['NEXT_PUBLIC_'+key])?'FAIL':'PASS',
    secretKeys.some(key=>!!env['NEXT_PUBLIC_'+key])?'PUBLIC_SECRET_PREFIX_DENIED':'NO_PUBLIC_SECRET_PREFIX'));
  return checks;
}
export async function checkDevReadiness(env:DevEnvironment,options:{live?:boolean;fetcher?:typeof fetch;databaseProbe?:()=>Promise<{schemaReady:boolean}>}={}) {
  const checks=inspectDevEnvironment(env),valid=(key:string)=>checks.some(c=>c.name===key&&c.status==='PASS');
  const finish=()=>({mode:options.live?'read-only-live':'configuration-only',status:checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='BLOCKED')?'BLOCKED':'PASS',checks});
  if(!options.live)return finish();
  if(!valid('APP_ENV')||['DEV_TARGET','SERVER_ONLY_SECRETS','APP_BASE_URL'].some(key=>checks.some(c=>c.name===key&&c.status==='FAIL'))) {
    checks.push(outcome('LIVE_PROBES','BLOCKED','DEV_SAFETY_CHECK_REQUIRED'));return finish();
  }
  const fetcher=options.fetcher??fetch;
  async function json(url:string,init:RequestInit) {
    const response=await fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
    if(!response.ok)throw new Error('PROVIDER_HTTP_'+response.status);
    return response.json();
  }
  async function safe(name:string,work:()=>Promise<SetupCheck[]>) {
    try{return await work();}catch(error){const message=error instanceof Error?error.message:'';
      return [outcome(name,'FAIL',/^PROVIDER_HTTP_\d{3}$/.test(message)?message:'CONNECTION_CHECK_FAILED')];}
  }
  const results=await Promise.all([
    safe('NEON_CONNECTION',async()=>{
      if(!valid('DATABASE_URL')||!options.databaseProbe)return [outcome('NEON_CONNECTION','BLOCKED','DATABASE_CONFIGURATION_REQUIRED')];
      const result=await options.databaseProbe();return [outcome('NEON_CONNECTION','PASS','QUERY_SUCCEEDED'),
        outcome('NEON_SCHEMA',result.schemaReady?'PASS':'BLOCKED',result.schemaReady?'MIGRATIONS_PRESENT':'MIGRATIONS_REQUIRED')];
    }),
    safe('TELEGRAM_CONNECTION',async()=>{
      if(!valid('TELEGRAM_BOT_TOKEN')||!valid('TELEGRAM_LOGIN_BOT_NAME'))return [outcome('TELEGRAM_CONNECTION','BLOCKED','BOT_CONFIGURATION_REQUIRED')];
      const bot=await json(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`,{method:'POST'});
      if(!bot.ok||bot.result?.is_bot!==true||String(bot.result.username).toLowerCase()!==env.TELEGRAM_LOGIN_BOT_NAME!.toLowerCase())return [outcome('TELEGRAM_IDENTITY','FAIL','BOT_IDENTITY_MISMATCH')];
      const result=[outcome('TELEGRAM_IDENTITY','PASS','EXPECTED_BOT_VERIFIED')];
      const webhook=await json(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`,{method:'POST'});
      if(!webhook.ok||typeof webhook.result?.url!=='string')return [...result,outcome('TELEGRAM_WEBHOOK_TARGET','FAIL','INVALID_PROVIDER_RESPONSE')];
      const target=webhook.result.url,configured=origin(env.APP_BASE_URL??'');
      let webhookHost='';try{webhookHost=new URL(target).hostname;}catch{}
      if(productionHosts.has(webhookHost))return [...result,outcome('TELEGRAM_WEBHOOK_TARGET','FAIL','PRODUCTION_WEBHOOK_DENIED')];
      if(!configured||configured.protocol!=='https:'||local(configured))return [...result,outcome('TELEGRAM_WEBHOOK_TARGET','BLOCKED','PUBLIC_DEV_ORIGIN_REQUIRED')];
      result.push(outcome('TELEGRAM_WEBHOOK_TARGET',target===configured.origin+'/api/telegram/webhook'?'PASS':target?'FAIL':'BLOCKED',
        target===configured.origin+'/api/telegram/webhook'?'EXPECTED_TARGET_VERIFIED':target?'UNEXPECTED_WEBHOOK_TARGET':'WEBHOOK_NOT_REGISTERED'));
      return result;
    }),
    safe('STREAM_CONNECTION',async()=>{
      if(!valid('CLOUDFLARE_ACCOUNT_ID')||!valid('CLOUDFLARE_STREAM_API_TOKEN'))return [outcome('STREAM_CONNECTION','BLOCKED','STREAM_CONFIGURATION_REQUIRED')];
      const result=await json(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream?limit=1`,{
        method:'GET',headers:{Authorization:`Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`},
      });
      return [outcome('STREAM_CONNECTION',result.success===true&&Array.isArray(result.result)?'PASS':'FAIL',
        result.success===true&&Array.isArray(result.result)?'STREAM_READ_VERIFIED':'INVALID_PROVIDER_RESPONSE')];
    }),
  ]);
  checks.push(...results.flat());return finish();
}
