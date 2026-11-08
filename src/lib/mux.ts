import { createHmac, createPrivateKey, sign, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { check } from './errors';

export type Fetcher = typeof fetch;
export const muxId = z.string().regex(/^[A-Za-z0-9_-]{1,255}$/);
export const muxAssetSchema = z.object({
  id:muxId, status:z.string(), upload_id:muxId.optional(), passthrough:z.string().optional(),
  duration:z.number().positive().optional(), video_quality:z.string().optional(),
  resolution_tier:z.string().optional(), max_resolution_tier:z.string().optional(),
  playback_ids:z.array(z.object({id:muxId,policy:z.string()})).default([]),
});
export type MuxAsset = z.infer<typeof muxAssetSchema>;
export async function muxApi<T=unknown>(path:string,method='GET',body?:unknown,fetcher:Fetcher=fetch):Promise<T> {
  const id=process.env.MUX_TOKEN_ID,secret=process.env.MUX_TOKEN_SECRET;
  check(id&&secret&&!/[\s:]/.test(id)&&!/[\s]/.test(secret),503,'MUX_NOT_CONFIGURED');
  check(/^\/(assets|uploads|signing-keys)(\/[A-Za-z0-9_-]+)?(\?limit=1)?$/.test(path),500,'INVALID_MUX_PATH');
  const response=await fetcher('https://api.mux.com/video/v1'+path,{
    method,headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),
  });
  check(response.ok,502,'MUX_UNAVAILABLE');
  const result=await response.json();check(result&&result.data!==undefined,502,'MUX_INVALID_RESPONSE');
  return result.data as T;
}
export function validateUploadUrl(value:string) {
  const url=new URL(value);
  check(url.protocol==='https:'&&url.hostname==='storage.googleapis.com'&&!url.username&&!url.password,502,'UNSAFE_UPLOAD_URL');
  return url.toString();
}
export async function createMuxUpload(origin:string,mediaId:string,fetcher:Fetcher=fetch) {
  const upload=await muxApi<{id:string;url:string}>('/uploads','POST',{
    cors_origin:origin,timeout:900,
    new_asset_settings:{playback_policies:['signed'],video_quality:'basic',max_resolution_tier:'1080p',master_access:'none',passthrough:mediaId},
  },fetcher);
  return {uploadId:muxId.parse(upload.id),uploadUrl:validateUploadUrl(upload.url)};
}
export async function getMuxAsset(id:string,fetcher:Fetcher=fetch) {
  return muxAssetSchema.parse(await muxApi('/assets/'+muxId.parse(id),'GET',undefined,fetcher));
}
export function privateAsset(asset:MuxAsset) {
  check(asset.status==='ready',409,'MEDIA_NOT_READY');
  check(asset.video_quality==='basic'&&['720p','1080p'].includes(asset.resolution_tier??'')&&
    (!asset.max_resolution_tier||asset.max_resolution_tier==='1080p'),409,'MUX_QUALITY_MISMATCH');
  check(asset.playback_ids.length>0&&asset.playback_ids.every(p=>p.policy==='signed'),409,'MUX_MUST_BE_PRIVATE');
  check(asset.duration&&asset.duration<=7200,409,'MUX_DURATION_UNSUPPORTED');
  return {playbackId:asset.playback_ids[0].id,duration:asset.duration};
}
export function muxSigningKey() {
  const id=process.env.MUX_SIGNING_KEY_ID,encoded=process.env.MUX_SIGNING_PRIVATE_KEY;
  check(id&&/^[A-Za-z0-9_-]{1,255}$/.test(id)&&encoded,503,'MUX_SIGNING_NOT_CONFIGURED');
  try {
    const key=createPrivateKey(encoded.startsWith('-----BEGIN ')?encoded:Buffer.from(encoded,'base64'));
    check(key.asymmetricKeyType==='rsa'&&(key.asymmetricKeyDetails?.modulusLength??0)>=2048,503,'MUX_SIGNING_NOT_CONFIGURED');
    return {id,key};
  } catch { check(false,503,'MUX_SIGNING_NOT_CONFIGURED'); }
}
export function signMuxPlayback(playbackId:string,duration:number,sessionExpires:number,now=Math.floor(Date.now()/1000)) {
  const signing=muxSigningKey();
  // Cover the complete lesson at 0.5x plus 15 minutes for pauses. Never outlive the server session.
  const expiresAt=now+Math.max(1800,Math.ceil(duration*2)+900);
  check(Number.isFinite(duration)&&duration>0&&duration<=7200,409,'MUX_DURATION_UNSUPPORTED');
  check(sessionExpires>=expiresAt,401,'SESSION_EXPIRES_SOON');
  const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:signing.id})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({sub:muxId.parse(playbackId),aud:'v',kid:signing.id,iat:now,exp:expiresAt})).toString('base64url');
  const input=header+'.'+claims,signature=sign('RSA-SHA256',Buffer.from(input),signing.key).toString('base64url');
  return {url:'https://stream.mux.com/'+playbackId+'.m3u8?token='+input+'.'+signature,issuedAt:now,expiresAt,durationSeconds:duration};
}
export function verifyMuxWebhook(raw:Buffer,header:string|null,now=Math.floor(Date.now()/1000)) {
  const secret=process.env.MUX_WEBHOOK_SIGNING_SECRET;
  check(secret&&secret.length>=20,503,'MUX_WEBHOOK_NOT_CONFIGURED');
  check(header&&header.length<=2048,401,'MUX_WEBHOOK_UNAUTHORIZED');
  const parts=header.split(',').map(part=>part.trim().split('='));
  const timestamps=parts.filter(([key])=>key==='t'),signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value);
  check(timestamps.length===1&&/^\d{10}$/.test(timestamps[0][1]??'')&&signatures.length>0&&signatures.length<=5,401,'MUX_WEBHOOK_UNAUTHORIZED');
  const timestamp=timestamps[0][1];check(Math.abs(now-Number(timestamp))<=300,401,'MUX_WEBHOOK_EXPIRED');
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  check(signatures.some(value=>/^[a-f0-9]{64}$/.test(value??'')&&timingSafeEqual(Buffer.from(value,'hex'),expected)),401,'MUX_WEBHOOK_UNAUTHORIZED');
  try {return z.object({id:muxId,type:z.string().min(1).max(100),data:z.record(z.string(),z.unknown())}).parse(JSON.parse(raw.toString('utf8')));}
  catch {check(false,400,'INVALID_MUX_EVENT');}
}
