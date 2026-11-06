import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { withDb, type Db } from './db';
import { AppError, check } from './errors';
import { apiResponse, baseUrl, cookieNames, cookiesForLogin, errorResponse, jsonBody, limitedBytes, requestTokens, sameOrigin } from './http';
import { audit, createLogin, downloadSignature, verifyDownload, equal, hash, hasGrant, principal, rateLimit, requireGrant, resetDevice, token, verifyTelegram, type Principal } from './security';
import { filterContent, getContent, listContent, saveContent, setProgress } from './content';
import { updateAccount } from './accounts';
import { deliverClaimed, dispatchOutbox, processTelegramUpdate, supportHistory, supportMessage } from './support';
import { privatePlayback, streamApi } from './providers';

type Runner = <T>(work:(db:Db)=>Promise<T>)=>Promise<T>;
const uuid=(value:string)=>z.uuid().parse(value);

export async function handleApi(req:NextRequest,path:string[],run:Runner=withDb) {
  const key=path.join('/'), method=req.method, url=req.nextUrl;
  try {
    if(key==='health') return apiResponse({service:'JUICY',environment:process.env.APP_ENV??'unconfigured',databaseConfigured:!!process.env.DATABASE_URL});
    if(key==='telegram/webhook') {
      check(method==='POST',405,'METHOD_NOT_ALLOWED');
      const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
      check(secret && secret.length>=32,503,'WEBHOOK_NOT_CONFIGURED');
      check(equal(req.headers.get('x-telegram-bot-api-secret-token')??'',secret),401,'WEBHOOK_UNAUTHORIZED');
      const result=await run(async db=>processTelegramUpdate(db,await jsonBody(req)));
      return apiResponse(result);
    }
    if(key==='auth/start' && method==='GET') {
      check(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_LOGIN_BOT_NAME,503,'TELEGRAM_NOT_CONFIGURED');
      const state=token();
      const response=NextResponse.redirect(baseUrl()+'/login?state='+state);
      response.headers.set('Cache-Control','no-store');
      response.cookies.set(cookieNames().state,state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
      return response;
    }
    if(key==='auth/telegram' && method==='GET') {
      const state=url.searchParams.get('state')??'';
      check(state.length===43 && equal(state,req.cookies.get(cookieNames().state)?.value??''),403,'LOGIN_STATE_INVALID');
      // Commit request-rate counters even for forged callbacks.
      const ip=process.env.VERCEL ? req.headers.get('x-real-ip')??'unknown' : 'local';
      await run(db=>rateLimit(db,'login-ip:'+hash(ip),20,300));
      const fields:Record<string,string>={};
      for(const [k,v] of url.searchParams) { if(k==='state') continue; check(!(k in fields),400,'DUPLICATE_LOGIN_FIELD'); fields[k]=v; }
      const identity=verifyTelegram(fields,process.env.TELEGRAM_BOT_TOKEN??'');
      const result=await run(db=>createLogin(db,identity,requestTokens(req).device));
      const response=NextResponse.redirect(baseUrl()+(result.status==='approved'?'/academy':'/access'));
      response.headers.set('Cache-Control','private, no-store'); response.headers.set('Referrer-Policy','no-referrer');
      cookiesForLogin(response,result.sessionToken,result.deviceToken); return response;
    }
    if(key!=='content')check(requestTokens(req).session&&requestTokens(req).device,401,'LOGIN_REQUIRED');
    if(method!=='GET') sameOrigin(req);
    if(key==='auth/logout' && method==='POST') {
      await run(async db=>{const p=await principal(db,requestTokens(req),true);
        // Session has a share lock; this transaction owns its own lock upgrade.
        await db.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[hash(requestTokens(req).session!)]);
        await audit(db,p.id,'session.logout',p.id);
      });
      const response=apiResponse({ok:true});response.cookies.set(cookieNames().session,'',{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:0});return response;
    }
    if(key==='session' && method==='GET') return apiResponse(await run(db=>principal(db,requestTokens(req),true)));
    if(key==='content' && method==='GET') {
      return apiResponse(await run(async db=>{
        const p=requestTokens(req).session ? await principal(db,requestTokens(req),true):undefined;
        let nodes=filterContent(await listContent(db,p),url.searchParams);
        if(url.searchParams.get('attachment')) {
          const links=(await db.query<{source_id:string;slug:string}>('SELECT l.source_id,c.slug FROM content_links l JOIN content c ON c.id=l.target_id WHERE c.kind=\'attachment\'')).rows;
          nodes=nodes.filter(n=>links.some(l=>l.source_id===n.id&&l.slug===url.searchParams.get('attachment')));
        }
        return nodes;
      }));
    }
    const result=await run(async db=>{
      const p=await principal(db,requestTokens(req));
      await rateLimit(db,'api:'+p.id,120);
      if(key==='profile' && method==='GET') {
        const visible=await listContent(db,p), ids=visible.map(n=>n.id);
        return {user:p,progress:(await db.query('SELECT * FROM lesson_progress WHERE user_id=$1 AND lesson_id=ANY($2::uuid[])',[p.id,ids])).rows,
          favorites:(await db.query('SELECT content_id FROM favorites WHERE user_id=$1 AND content_id=ANY($2::uuid[])',[p.id,ids])).rows,
          registrations:(await db.query('SELECT event_id,status FROM event_registrations WHERE user_id=$1 AND event_id=ANY($2::uuid[])',[p.id,ids])).rows};
      }
      if(key==='progress' && method==='POST') {
        const data=z.object({lessonId:z.uuid(),position:z.number().int().min(0).max(86400),completed:z.boolean()}).strict().parse(await jsonBody(req));
        await setProgress(db,p,data.lessonId,data.position,data.completed);return {ok:true};
      }
      if(key==='favorites' && method==='POST') {
        const data=z.object({contentId:z.uuid(),enabled:z.boolean()}).strict().parse(await jsonBody(req));
        await getContent(db,data.contentId,p);
        if(data.enabled) await db.query('INSERT INTO favorites(user_id,content_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[p.id,data.contentId]);
        else await db.query('DELETE FROM favorites WHERE user_id=$1 AND content_id=$2',[p.id,data.contentId]);
        return {ok:true};
      }
      if(key==='support' && method==='GET') return supportHistory(db,p);
      if(key==='support' && method==='POST') {
        const data=z.object({body:z.string().trim().min(1).max(4000)}).strict().parse(await jsonBody(req));
        return {threadId:await supportMessage(db,p,data.body)};
      }
      if(key==='studio/support' && method==='GET') return supportHistory(db,p,true);
      if(key==='studio/support' && method==='POST') {
        const data=z.object({threadId:z.uuid(),body:z.string().trim().min(1).max(3900)}).strict().parse(await jsonBody(req));
        return {threadId:await supportMessage(db,p,data.body,data.threadId)};
      }
      if(key==='studio/content' && method==='GET') return listContent(db,p,true);
      if(key==='studio/content' && method==='POST') return {id:await saveContent(db,p,await jsonBody(req))};
      if(path[0]==='studio'&&path[1]==='content'&&path.length===3&&method==='PATCH') return {id:await saveContent(db,p,await jsonBody(req),uuid(path[2]))};
      if(key==='studio/accounts' && method==='GET') {
        requireGrant(p,'students.read');
        return (await db.query("SELECT id,display_name,status,role,created_at FROM users WHERE $1::boolean OR role IN ('student','ambassador') ORDER BY created_at DESC LIMIT 200",[p.role==='techadmin'])).rows;
      }
      if(path[0]==='studio'&&path[1]==='accounts'&&path.length===3&&method==='POST') {await updateAccount(db,p,uuid(path[2]),await jsonBody(req));return {ok:true};}
      if(path[0]==='studio'&&path[1]==='devices'&&path.length===3&&method==='POST') {await resetDevice(db,p,uuid(path[2]));return {ok:true};}
      if(key==='studio/audit'&&method==='GET') {
        check(p.role==='techadmin',403,'TECHADMIN_ONLY');
        return (await db.query('SELECT id,actor_id,operation,entity_id,metadata,created_at FROM audit_events ORDER BY created_at DESC LIMIT 200')).rows;
      }
      if(key==='studio/outbox'&&method==='GET') {requireGrant(p,'support.read');return (await db.query('SELECT id,state,attempts,created_at FROM notification_outbox ORDER BY created_at DESC LIMIT 100')).rows;}
      if(key==='studio/outbox/retry'&&method==='POST') {
        requireGrant(p,'support.respond'); await db.query("UPDATE notification_outbox SET state='pending',attempts=0,next_attempt_at=now() WHERE state='failed'");
        await audit(db,p.id,'notifications.retry','outbox');return {ok:true};
      }
      if(key==='studio/media'&&method==='GET') {requireGrant(p,'media.upload');return (await db.query('SELECT id,kind,state,created_at FROM media ORDER BY created_at DESC LIMIT 200')).rows;}
      if(key==='studio/media/upload'&&method==='POST') return uploadFile(db,p,req);
      if(key==='studio/media/stream'&&method==='POST') {
        requireGrant(p,'media.upload');
        const result=await streamApi('/direct_upload','POST',{maxDurationSeconds:7200,requireSignedURLs:true,allowedOrigins:[new URL(baseUrl()).hostname],expiry:new Date(Date.now()+15*60000).toISOString()});
        check(/^[a-f0-9]{32}$/.test(result.uid),502,'INVALID_STREAM_ID');
        const uploadUrl=new URL(result.uploadURL);check(uploadUrl.protocol==='https:'&&uploadUrl.hostname==='upload.videodelivery.net',502,'UNSAFE_UPLOAD_URL');
        const media=(await db.query<{id:string}>("INSERT INTO media(kind,provider,provider_id,state,created_by) VALUES('video','stream',$1,'uploading',$2) RETURNING id",[result.uid,p.id])).rows[0];
        await audit(db,p.id,'media.stream.create',media.id);return {id:media.id,uploadUrl:result.uploadURL};
      }
      if(path[0]==='studio'&&path[1]==='media'&&path.length===4&&path[3]==='refresh'&&method==='POST') {
        requireGrant(p,'media.upload'); const media=(await db.query<{provider_id:string}>("SELECT provider_id FROM media WHERE id=$1 AND provider='stream' FOR UPDATE",[uuid(path[2])])).rows[0];check(media,404,'MEDIA_NOT_FOUND');
        const info=await streamApi('/'+media.provider_id);check(info.requireSignedURLs===true,409,'STREAM_MUST_BE_PRIVATE');
        const state=info.readyToStream?'ready':info.status?.state==='error'?'failed':'processing';
        await db.query('UPDATE media SET state=$2 WHERE id=$1',[path[2],state]);return {state};
      }
      if(path[0]==='media'&&path.length===3&&method==='GET') {
        const id=uuid(path[1]);
        const nodes=await listContent(db,p);
        const links=(await db.query<{content_id:string}>('SELECT content_id FROM content_media WHERE media_id=$1',[id])).rows;
        check(links.some(l=>nodes.some(n=>n.id===l.content_id)),403,'MEDIA_ACCESS_DENIED');
        const media=(await db.query<{kind:string;provider_id:string;state:string;mime:string;bytes:Buffer}>('SELECT kind,provider_id,state,mime,bytes FROM media WHERE id=$1',[id])).rows[0];
        check(media?.state==='ready',409,'MEDIA_NOT_READY');
        if(path[2]==='playback') {check(media.kind==='video',400,'VIDEO_REQUIRED');await rateLimit(db,'playback:'+p.id,20);return privatePlayback(media.provider_id);}
        if(path[2]==='download') {check(media.kind==='document',400,'DOCUMENT_REQUIRED');const expires=Math.floor(Date.now()/1000)+120;const signature=downloadSignature(id,requestTokens(req).session!,expires);return {url:`/api/media/${id}/file?expires=${expires}&signature=${signature}`};}
        if(path[2]==='file') {check(media.kind!=='video',400,'FILE_REQUIRED');if(media.kind==='document')verifyDownload(id,requestTokens(req).session!,Number(url.searchParams.get('expires')),url.searchParams.get('signature')??'');return new NextResponse(new Uint8Array(media.bytes),{headers:{'Content-Type':media.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${media.kind==='document'?'attachment':'inline'}; filename="${id}.${media.kind==='document'?'pdf':'img'}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});}
      }
      if(path[0]==='events'&&path[2]==='register'&&path.length===3&&method==='POST') {
        // Acquire the exclusive event lock before catalog share locks, avoiding lock-upgrade races.
        await db.query('SELECT id FROM content WHERE id=$1 FOR UPDATE',[uuid(path[1])]);
        const event=await getContent(db,uuid(path[1]),p);check(event.kind==='event',400,'EVENT_REQUIRED');
        const data=z.object({cancel:z.boolean().default(false)}).strict().parse(await jsonBody(req));
        check(event.data.startsAt&&new Date(event.data.startsAt)>new Date(),409,'EVENT_CLOSED');
        const registrations=(await db.query<{user_id:string;status:string}>('SELECT user_id,status FROM event_registrations WHERE event_id=$1',[event.id])).rows;
        const existing=registrations.find(r=>r.user_id===p.id);
        const status=data.cancel?'cancelled':existing?.status==='registered'?'registered':registrations.filter(r=>r.status==='registered').length<Number(event.data.capacity)?'registered':'waitlist';
        await db.query('INSERT INTO event_registrations(user_id,event_id,status) VALUES($1,$2,$3) ON CONFLICT(user_id,event_id) DO UPDATE SET status=$3',[p.id,event.id,status]);return {status};
      }
      if(key==='city-interests'&&method==='POST') {
        const data=z.object({city:z.string().trim().min(1).max(120),topic:z.string().trim().min(1).max(200)}).strict().parse(await jsonBody(req));
        await rateLimit(db,'city:'+p.id,5,86400);
        await db.query('INSERT INTO city_interests(user_id,city,topic) VALUES($1,$2,$3)',[p.id,data.city,data.topic]);return {ok:true};
      }
      throw new AppError(404,'ROUTE_NOT_FOUND');
    });
    return result instanceof NextResponse?result:apiResponse(result);
  } catch(error) {return errorResponse(error);}
}

async function uploadFile(db:Db,p:Principal,req:NextRequest) {
  requireGrant(p,'media.upload');await rateLimit(db,'upload:'+p.id,10);
  const mime=req.headers.get('content-type')??'';
  check(['application/pdf','image/jpeg','image/png','image/webp'].includes(mime),415,'MEDIA_TYPE_DENIED');
  const bytes=await limitedBytes(req,4000000);
  check(bytes.length>8,400,'INVALID_FILE');
  if(mime==='application/pdf') check(bytes.subarray(0,5).toString()==='%PDF-',400,'INVALID_PDF');
  else {
    const sharp=(await import('sharp')).default;
    const info=await sharp(bytes,{limitInputPixels:25000000}).metadata();
    const expected:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
    check(info.width&&info.height&&info.width<=10000&&info.height<=10000&&info.format===expected[mime],400,'INVALID_IMAGE');
  }
  const media=(await db.query<{id:string}>("INSERT INTO media(kind,provider,mime,bytes,state,created_by) VALUES($1,'postgres',$2,$3,'ready',$4) RETURNING id",[mime==='application/pdf'?'document':'image',mime,bytes,p.id])).rows[0];
  await audit(db,p.id,'media.upload',media.id);return media;
}

// Invoked after the response by the Vercel Function lifecycle; no persistent worker.
export function scheduleNotifications() {
  if(!process.env.DATABASE_URL||!process.env.TELEGRAM_BOT_TOKEN) return;
  after(async()=>{
    try {const items=await withDb(db=>dispatchOutbox(db));await withDb(db=>deliverClaimed(db,items));}
    catch { console.error('JUICY notification dispatch unavailable'); }
  });
}
