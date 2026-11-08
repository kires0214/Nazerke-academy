import { check } from './errors';

type Fetcher = typeof fetch;
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
