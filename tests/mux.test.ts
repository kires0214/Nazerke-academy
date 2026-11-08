import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,verify} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fixture} from './helpers';
import {configureMux,syntheticMux,syntheticPublicKey} from './mux-fixtures';
import {handleApi} from '../src/lib/api';
import {cookieNames} from '../src/lib/http';
import {createLogin,hash,type Tokens} from '../src/lib/security';
import {privateAsset,signMuxPlayback,validateUploadUrl,verifyMuxWebhook} from '../src/lib/mux';
import {leaseNeedsRenewal,putDirectVideo,refreshMuxRequest,replaceNativeSource,validateLease} from '../src/lib/video-client';

const base='https://dev.juicy.invalid';process.env.APP_ENV='DEV';process.env.APP_BASE_URL=base;
function request(path:string,method='GET',tokens?:Tokens,body?:unknown){
  const names=cookieNames();return new NextRequest(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(tokens?{Cookie:names.session+'='+tokens.session+'; '+names.device+'='+tokens.device}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
function webhook(event:unknown,signature?:string){const raw=JSON.stringify(event),now=Math.floor(Date.now()/1000);return new NextRequest(base+'/api/mux/webhook',{method:'POST',body:raw,headers:{'Content-Type':'application/json','Mux-Signature':signature??('t='+now+',v1='+createHmac('sha256',syntheticMux.MUX_WEBHOOK_SIGNING_SECRET).update(now+'.'+raw).digest('hex'))}});}
function fakeMux(){
  const state={requests:0,assetRequests:0,uploaded:false,status:'preparing',policy:'signed',quality:'basic',resolution:'1080p',mediaId:'',uploadId:'SyntheticMuxUpload01',assetId:'SyntheticMuxAsset01',playbackId:'SyntheticMuxPlayback01'};
  const asset=()=>({id:state.assetId,upload_id:state.uploadId,passthrough:state.mediaId,status:state.status,duration:1800,video_quality:state.quality,resolution_tier:state.resolution,max_resolution_tier:'1080p',playback_ids:[{id:state.playbackId,policy:state.policy}]});
  const fetcher:typeof fetch=async(url,init)=>{
    state.requests++;const target=String(url);
    if(target.startsWith('https://storage.googleapis.com/')){assert.equal(init?.method,'PUT');assert.ok(init?.body instanceof Blob);assert.equal(init?.credentials,'omit');state.uploaded=true;return new Response(null,{status:200});}
    assert.match(target,/^https:\/\/api\.mux\.com\/video\/v1\//);
    assert.ok(String((init?.headers as Record<string,string>)?.Authorization).startsWith('Basic '));
    if(target.endsWith('/uploads')&&init?.method==='POST'){
      const data=JSON.parse(String(init.body));assert.equal(data.cors_origin,base);assert.equal(data.timeout,900);
      assert.deepEqual(data.new_asset_settings.playback_policies,['signed']);assert.equal(data.new_asset_settings.video_quality,'basic');assert.equal(data.new_asset_settings.max_resolution_tier,'1080p');assert.equal(data.new_asset_settings.master_access,'none');
      assert.equal(data.new_asset_settings.advanced_playback_policies,undefined);state.mediaId=data.new_asset_settings.passthrough;
      return Response.json({data:{id:state.uploadId,url:'https://storage.googleapis.com/synthetic-mux-upload?signature=synthetic'}});
    }
    if(target.endsWith('/uploads/'+state.uploadId))return Response.json({data:{id:state.uploadId,status:state.uploaded?'asset_created':'waiting',...(state.uploaded?{asset_id:state.assetId}:{})}});
    if(target.endsWith('/assets/'+state.assetId)){state.assetRequests++;return Response.json({data:asset()});}
    throw new Error('Unexpected mocked provider request');
  };
  return {state,fetcher,asset};
}
test('browser upload → verified processing/ready callbacks → authorized RS256 private playback',async()=>{
  const restore=configureMux(),f=await fixture(),mux=fakeMux(),originalFetch=globalThis.fetch;globalThis.fetch=mux.fetcher;
  try{
    const tech=await f.account('techadmin'),student=await f.account();
    const upload=await handleApi(request('studio/media/mux','POST',tech.tokens,{}),['studio','media','mux'],f.run);assert.equal(upload.status,200);
    const media=await upload.json();assert.equal(media.uploadId,undefined);assert.equal(JSON.stringify(media).includes(syntheticMux.MUX_TOKEN_SECRET),false);
    await putDirectVideo(media.uploadUrl,new Blob(['synthetic DEV video'],{type:'video/mp4'}),AbortSignal.timeout(1000),mux.fetcher);
    assert.equal(mux.state.uploaded,true);
    const created={id:'evt_created',type:'video.upload.asset_created',data:{id:mux.state.uploadId,asset_id:mux.state.assetId}};
    assert.equal((await handleApi(webhook(created),['mux','webhook'],f.run)).status,200);
    assert.equal((await f.engine.query<{state:string}>('SELECT state FROM media WHERE id=$1',[media.id])).rows[0].state,'processing');
    const recipe=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[recipe.id,media.id]);
    const path=['media',media.id,'playback'];assert.equal((await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run)).status,409);
    mux.state.status='ready';const ready={id:'evt_ready',type:'video.asset.ready',data:{id:mux.state.assetId,upload_id:mux.state.uploadId}};
    assert.equal((await handleApi(webhook(ready),['mux','webhook'],f.run)).status,200);
    const before=mux.state.requests;const duplicate=await handleApi(webhook(ready),['mux','webhook'],f.run);assert.deepEqual(await duplicate.json(),{duplicate:true});assert.equal(mux.state.requests,before);
    const response=await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control')??'',/private, no-store/);
    const lease=validateLease(await response.json()),jwt=new URL(lease.url).searchParams.get('token')!,[header,payload,signature]=jwt.split('.');
    assert.equal(verify('RSA-SHA256',Buffer.from(header+'.'+payload),syntheticPublicKey,Buffer.from(signature,'base64url')),true);
    assert.deepEqual(JSON.parse(Buffer.from(header,'base64url').toString()),{alg:'RS256',typ:'JWT',kid:syntheticMux.MUX_SIGNING_KEY_ID});
    const claims=JSON.parse(Buffer.from(payload,'base64url').toString());assert.equal(claims.sub,mux.state.playbackId);assert.equal(claims.aud,'v');assert.equal(claims.kid,syntheticMux.MUX_SIGNING_KEY_ID);assert.equal(claims.exp-claims.iat,4500);assert.equal(claims.role,undefined);assert.equal(claims.userId,undefined);
    assert.equal(leaseNeedsRenewal(lease,1000,0,0.5,1000),false);
    // Ready-first and delayed asset_created deliveries must not regress state.
    assert.equal((await handleApi(webhook({...created,id:'evt_created_late'}),['mux','webhook'],f.run)).status,200);
    assert.equal((await f.engine.query<{state:string}>('SELECT state FROM media WHERE id=$1',[media.id])).rows[0].state,'ready');
  }finally{globalThis.fetch=originalFetch;restore();await f.close();}
});
test('unauthorized roles, revoked sessions, second browser and hidden content cannot reach Mux or receive tokens',async()=>{
  const restore=configureMux(),f=await fixture(),mux=fakeMux(),originalFetch=globalThis.fetch;globalThis.fetch=mux.fetcher;
  try{
    const tech=await f.account('techadmin'),student=await f.account(),pending=await f.account('student','pending',[]),unentitled=await f.account('student','approved',[]),staff=await f.account('admin','approved',[],['media.upload']);
    const upload=await handleApi(request('studio/media/mux','POST',tech.tokens,{}),['studio','media','mux'],f.run);const media=await upload.json();
    mux.state.status='ready';await handleApi(webhook({id:'evt_ready_first',type:'video.asset.ready',data:{id:mux.state.assetId,upload_id:mux.state.uploadId}}),['mux','webhook'],f.run);
    const recipe=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[recipe.id,media.id]);
    const path=['media',media.id,'playback'],before=mux.state.requests;
    for(const [tokens,status] of [[undefined,401],[pending.tokens,403],[unentitled.tokens,403],[staff.tokens,403],[{session:student.tokens.session,device:'different-browser'},401]] as const)
      assert.equal((await handleApi(request(path.join('/'),'GET',tokens),path,f.run)).status,status);
    assert.equal(mux.state.requests,before);
    assert.equal((await handleApi(request('studio/media/mux','POST',student.tokens,{}),['studio','media','mux'],f.run)).status,403);
    assert.equal(mux.state.requests,before);
    const replacement=await f.run(db=>createLogin(db,{telegramId:student.telegramId,name:'Synthetic DEV',receipt:hash('replacement-mux-test')},student.tokens.device));
    assert.equal((await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run)).status,401);
    const fresh={session:replacement.sessionToken,device:replacement.deviceToken};
    await f.engine.query("UPDATE content SET status='hidden' WHERE id=$1",[recipe.id]);assert.equal((await handleApi(request(path.join('/'),'GET',fresh),path,f.run)).status,403);
    assert.equal(mux.state.requests,before);
    const publicPost=(await f.engine.query<{id:string}>("INSERT INTO content(kind,slug,title,status,audience) VALUES('post','public-with-media','Synthetic public','published','public') RETURNING id")).rows[0];await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[publicPost.id,media.id]);
    assert.equal((await handleApi(request(path.join('/'),'GET',staff.tokens),path,f.run)).status,403);assert.equal(mux.state.requests,before);
  }finally{globalThis.fetch=originalFetch;restore();await f.close();}
});
test('webhook raw signatures, timestamp, replay and terminal state prevent forged or out-of-order grants',async()=>{
  const restore=configureMux(),f=await fixture(),mux=fakeMux(),originalFetch=globalThis.fetch;globalThis.fetch=mux.fetcher;
  try{
    const tech=await f.account('techadmin');const upload=await handleApi(request('studio/media/mux','POST',tech.tokens,{}),['studio','media','mux'],f.run);const media=await upload.json();
    const event={id:'evt_terminal',type:'video.upload.cancelled',data:{id:mux.state.uploadId}};
    for(const signature of ['t=1793960000,v1='+'a'.repeat(64),'t='+Math.floor(Date.now()/1000)+',v1='+'a'.repeat(64),null]){
      const req=webhook(event,signature??undefined);if(signature===null)req.headers.delete('mux-signature');assert.equal((await handleApi(req,['mux','webhook'],f.run)).status,401);
    }
    assert.equal((await f.engine.query('SELECT * FROM mux_webhook_events')).rows.length,0);
    const raw=Buffer.from('{"id":"evt_raw","type":"x","data":{}}'),stamp=Math.floor(Date.now()/1000),signature=createHmac('sha256',syntheticMux.MUX_WEBHOOK_SIGNING_SECRET).update(stamp+'.').update(raw).digest('hex');
    assert.throws(()=>verifyMuxWebhook(Buffer.from(raw.toString()+' '),'t='+stamp+',v1='+signature),/UNAUTHORIZED/);
    assert.throws(()=>verifyMuxWebhook(raw,'t='+(stamp+301)+',v1='+signature),/EXPIRED/);
    assert.equal((await handleApi(webhook(event),['mux','webhook'],f.run)).status,200);
    mux.state.status='ready';assert.equal((await handleApi(webhook({id:'evt_late_ready',type:'video.asset.ready',data:{id:mux.state.assetId,upload_id:mux.state.uploadId}}),['mux','webhook'],f.run)).status,200);
    const stored=(await f.engine.query<{state:string;mux_terminal:boolean}>('SELECT state,mux_terminal FROM media WHERE id=$1',[media.id])).rows[0];assert.deepEqual(stored,{state:'failed',mux_terminal:true});
    assert.equal(mux.state.assetRequests,0);
  }finally{globalThis.fetch=originalFetch;restore();await f.close();}
});
test('canonical provider privacy/Basic 1080p/DRM checks fail closed, even for a ready DB row',async()=>{
  const restore=configureMux(),f=await fixture(),mux=fakeMux(),originalFetch=globalThis.fetch;globalThis.fetch=mux.fetcher;
  try{
    const tech=await f.account('techadmin'),student=await f.account();const upload=await handleApi(request('studio/media/mux','POST',tech.tokens,{}),['studio','media','mux'],f.run);const media=await upload.json();
    const ready={id:'evt_privacy',type:'video.asset.ready',data:{id:mux.state.assetId,upload_id:mux.state.uploadId}};mux.state.status='ready';mux.state.policy='public';
    assert.equal((await handleApi(webhook(ready),['mux','webhook'],f.run)).status,409);assert.equal((await f.engine.query('SELECT * FROM mux_webhook_events')).rows.length,0);
    mux.state.policy='signed';assert.equal((await handleApi(webhook(ready),['mux','webhook'],f.run)).status,200);
    const recipe=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[recipe.id,media.id]);const path=['media',media.id,'playback'];
    for(const policy of ['public','drm']){mux.state.policy=policy;assert.equal((await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run)).status,409);}
    mux.state.policy='signed';mux.state.quality='plus';assert.equal((await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run)).status,409);
    mux.state.quality='basic';mux.state.resolution='2160p';assert.equal((await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run)).status,409);
    mux.state.resolution='1080p';delete process.env.MUX_SIGNING_PRIVATE_KEY;const missing=await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run);assert.equal(missing.status,503);assert.equal(JSON.stringify(await missing.json()).includes(syntheticMux.MUX_TOKEN_SECRET),false);
  }finally{globalThis.fetch=originalFetch;restore();await f.close();}
});
test('duration-aware expiry covers lessons, requests renewal after a long pause and never outlives session',()=>{
  const restore=configureMux();try{
    const now=1793960000,lease=signMuxPlayback('SyntheticPlayback',7200,now+20000,now);assert.equal(lease.expiresAt,now+15300);
    assert.equal(leaseNeedsRenewal(lease,0,0,0.5,0),false);assert.equal(leaseNeedsRenewal(lease,0,100,0.5,14000000),true);
    assert.throws(()=>signMuxPlayback('SyntheticPlayback',7200,now+100,now),/SESSION_EXPIRES_SOON/);
    const refreshed=signMuxPlayback('SyntheticPlayback',7200,now+40000,now+1000);
    const requestUrl='https://stream.mux.com/SyntheticPlayback/level.m3u8?token=old&rendition=1080';const next=refreshMuxRequest(requestUrl,refreshed.url);assert.equal(new URL(next).searchParams.get('token'),new URL(refreshed.url).searchParams.get('token'));assert.equal(new URL(next).searchParams.get('rendition'),'1080');
    const hostile='https://mux.com.attacker.invalid/?token=old';assert.equal(refreshMuxRequest(hostile,refreshed.url),hostile);
    assert.throws(()=>validateUploadUrl('https://storage.googleapis.com.attacker.invalid/video'),/UNSAFE_UPLOAD_URL/);
    assert.throws(()=>privateAsset({id:'x',status:'ready',duration:1,video_quality:'basic',resolution_tier:'1080p',playback_ids:[{id:'x',policy:'drm'}]}),/MUX_MUST_BE_PRIVATE/);
  }finally{restore();}
});
test('provider failure rolls back webhook receipt for retry; historical provider IDs are never interpreted as Mux',async()=>{
  const restore=configureMux(),f=await fixture(),mux=fakeMux(),originalFetch=globalThis.fetch;globalThis.fetch=mux.fetcher;
  try{
    const tech=await f.account('techadmin'),student=await f.account();const upload=await handleApi(request('studio/media/mux','POST',tech.tokens,{}),['studio','media','mux'],f.run);const media=await upload.json();
    const ready={id:'evt_retry',type:'video.asset.ready',data:{id:mux.state.assetId,upload_id:mux.state.uploadId}};mux.state.status='ready';
    globalThis.fetch=async()=>Response.json({error:'synthetic provider failure'},{status:503});assert.equal((await handleApi(webhook(ready),['mux','webhook'],f.run)).status,502);
    assert.equal((await f.engine.query('SELECT * FROM mux_webhook_events')).rows.length,0);
    assert.equal((await f.engine.query<{state:string}>('SELECT state FROM media WHERE id=$1',[media.id])).rows[0].state,'uploading');
    globalThis.fetch=mux.fetcher;assert.equal((await handleApi(webhook(ready),['mux','webhook'],f.run)).status,200);
    const recipe=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];
    const legacy=(await f.engine.query<{id:string;provider_id:string}>("INSERT INTO media(kind,provider,provider_id,state,created_by) VALUES('video','stream',$1,'ready',$2) RETURNING id,provider_id",['a'.repeat(32),tech.id])).rows[0];
    await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[recipe.id,legacy.id]);const before=mux.state.requests,path=['media',legacy.id,'playback'];
    const response=await handleApi(request(path.join('/'),'GET',student.tokens),path,f.run);assert.equal(response.status,409);assert.equal((await response.json()).error,'MUX_VIDEO_REQUIRED');assert.equal(mux.state.requests,before);
    assert.equal((await f.engine.query<{provider_id:string}>('SELECT provider_id FROM media WHERE id=$1',[legacy.id])).rows[0].provider_id,legacy.provider_id);
  }finally{globalThis.fetch=originalFetch;restore();await f.close();}
});
test('native HLS renewal restores the same playhead and paused/playing state',async()=>{
  class FakeVideo extends EventTarget {currentTime=326;paused=false;src='';loads=0;plays=0;load(){this.loads++;this.currentTime=0;}async play(){this.plays++;this.paused=false;}}
  const video=new FakeVideo(),abort=new AbortController();replaceNativeSource(video as unknown as HTMLVideoElement,'https://stream.mux.com/synthetic.m3u8',abort.signal);
  video.dispatchEvent(new Event('loadedmetadata'));assert.equal(video.currentTime,326);assert.equal(video.plays,1);
  video.paused=true;video.currentTime=412;replaceNativeSource(video as unknown as HTMLVideoElement,'https://stream.mux.com/new.m3u8',abort.signal);video.dispatchEvent(new Event('loadedmetadata'));assert.equal(video.currentTime,412);assert.equal(video.plays,1);
  abort.abort();
});
