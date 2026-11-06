import { check } from './errors';

type Fetcher = typeof fetch;
export async function streamApi(path:string, method='GET', body?:unknown, fetcher:Fetcher=fetch) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID, secret=process.env.CLOUDFLARE_STREAM_API_TOKEN;
  check(account && /^[a-f0-9]{32}$/.test(account) && secret,503,'STREAM_NOT_CONFIGURED');
  const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/stream${path}`,{
    method,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000),cache:'no-store',
  });
  check(response.ok,502,'STREAM_UNAVAILABLE');
  const result=await response.json();
  check(result.success && result.result,502,'STREAM_REQUEST_FAILED');
  return result.result;
}
export async function privatePlayback(providerId:string,fetcher:Fetcher=fetch) {
  check(/^[a-f0-9]{32}$/.test(providerId),400,'INVALID_STREAM_ID');
  const info=await streamApi('/'+providerId,'GET',undefined,fetcher);
  check(info.requireSignedURLs===true && info.readyToStream===true,409,'PRIVATE_VIDEO_NOT_READY');
  const expires=Math.floor(Date.now()/1000)+120;
  const result=await streamApi('/'+providerId+'/token','POST',{exp:expires,downloadable:false},fetcher);
  check(typeof result.token==='string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(result.token),502,'INVALID_STREAM_TOKEN');
  let claims; try { claims=JSON.parse(Buffer.from(result.token.split('.')[1],'base64url').toString()); } catch { check(false,502,'INVALID_STREAM_TOKEN'); }
  check(claims.sub===providerId && Number(claims.exp)<=expires && Number(claims.exp)>Math.floor(Date.now()/1000),502,'UNSAFE_STREAM_EXPIRY');
  return { url:`https://iframe.cloudflarestream.com/${result.token}`,expiresAt:expires };
}
export async function telegramSend(chatId:string,body:string,fetcher:Fetcher=fetch) {
  const secret=process.env.TELEGRAM_BOT_TOKEN;
  check(secret && /^\d+:[\w-]+$/.test(secret),503,'TELEGRAM_NOT_CONFIGURED');
  const response=await fetcher(`https://api.telegram.org/bot${secret}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:body,link_preview_options:{is_disabled:true}}),
    signal:AbortSignal.timeout(8000),cache:'no-store',
  });
  check(response.ok,502,'TELEGRAM_UNAVAILABLE');
  const result=await response.json(); check(result.ok && result.result?.message_id,502,'TELEGRAM_DELIVERY_FAILED');
  return String(result.result.message_id);
}
