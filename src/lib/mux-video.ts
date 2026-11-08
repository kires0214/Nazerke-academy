import type { Db } from './db';
import { check } from './errors';
import { audit, hash, requireGrant, type Principal } from './security';
import { createMuxUpload,getMuxAsset,muxApi,muxId,privateAsset,signMuxPlayback,type Fetcher,verifyMuxWebhook } from './mux';

type Video=Record<string,unknown>&{id:string;provider_id:string|null;mux_upload_id:string;mux_playback_id:string|null;state:string;mux_terminal:boolean};
export async function startVideo(db:Db,actor:Principal,origin:string,fetcher:Fetcher=fetch) {
  requireGrant(actor,'media.upload');
  const media=(await db.query<{id:string}>("INSERT INTO media(kind,provider,state,created_by) VALUES('video','mux','uploading',$1) RETURNING id",[actor.id])).rows[0];
  const upload=await createMuxUpload(origin,media.id,fetcher);
  await db.query('UPDATE media SET mux_upload_id=$2 WHERE id=$1',[media.id,upload.uploadId]);
  await audit(db,actor.id,'media.mux.create',media.id);
  return {id:media.id,uploadUrl:upload.uploadUrl};
}
async function updateFromAsset(db:Db,media:Video,assetId:string,fetcher:Fetcher) {
  if(media.mux_terminal)return {state:'failed'};
  const asset=await getMuxAsset(assetId,fetcher);
  check(asset.id===assetId&&(!media.provider_id||media.provider_id===asset.id)&&asset.upload_id===media.mux_upload_id&&asset.passthrough===media.id,409,'MUX_ASSET_MISMATCH');
  if(asset.status==='errored') {
    await db.query("UPDATE media SET provider_id=$2,state='failed',mux_terminal=true WHERE id=$1",[media.id,asset.id]);return {state:'failed'};
  }
  if(asset.status!=='ready') {
    await db.query("UPDATE media SET provider_id=$2,state=CASE WHEN state='ready' THEN state ELSE 'processing' END WHERE id=$1",[media.id,asset.id]);return {state:media.state==='ready'?'ready':'processing'};
  }
  const privateVideo=privateAsset(asset);
  check(!media.mux_playback_id||asset.playback_ids.some(p=>p.id===media.mux_playback_id),409,'MUX_ASSET_MISMATCH');
  await db.query("UPDATE media SET provider_id=$2,mux_playback_id=$3,duration_seconds=$4,state='ready' WHERE id=$1",[media.id,asset.id,media.mux_playback_id??privateVideo.playbackId,privateVideo.duration]);
  return {state:'ready'};
}
export async function refreshVideo(db:Db,actor:Principal,id:string,fetcher:Fetcher=fetch) {
  requireGrant(actor,'media.upload');
  const media=(await db.query<Video>("SELECT id,provider_id,mux_upload_id,mux_playback_id,state,mux_terminal FROM media WHERE id=$1 AND provider='mux' FOR UPDATE",[id])).rows[0];
  check(media,404,'MEDIA_NOT_FOUND');if(media.mux_terminal)return {state:'failed'};
  if(media.provider_id)return updateFromAsset(db,media,media.provider_id,fetcher);
  const upload=await muxApi<{id:string;status:string;asset_id?:string}>('/uploads/'+muxId.parse(media.mux_upload_id),'GET',undefined,fetcher);
  check(upload.id===media.mux_upload_id,409,'MUX_ASSET_MISMATCH');
  if(upload.asset_id)return updateFromAsset(db,media,muxId.parse(upload.asset_id),fetcher);
  const failed=['errored','timed_out','cancelled'].includes(upload.status),state=failed?'failed':'uploading';
  await db.query('UPDATE media SET state=$2,mux_terminal=$3 WHERE id=$1',[id,state,failed]);return {state};
}
export async function receiveMuxEvent(db:Db,event:ReturnType<typeof verifyMuxWebhook>,fetcher:Fetcher=fetch) {
  const inserted=await db.query('INSERT INTO mux_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);
  if(!inserted.rows.length)return {duplicate:true};
  const uploadEvent=event.type.startsWith('video.upload.'),assetEvent=event.type.startsWith('video.asset.');
  if(!uploadEvent&&!assetEvent)return {ignored:true};
  if(!['video.upload.asset_created','video.upload.errored','video.upload.cancelled','video.upload.timed_out','video.asset.ready','video.asset.errored','video.asset.deleted'].includes(event.type))return {ignored:true};
  const uploadId=uploadEvent?muxId.parse(event.data.id):typeof event.data.upload_id==='string'?muxId.parse(event.data.upload_id):null;
  const assetId=assetEvent?muxId.parse(event.data.id):typeof event.data.asset_id==='string'?muxId.parse(event.data.asset_id):null;
  const media=(await db.query<Video>("SELECT id,provider_id,mux_upload_id,mux_playback_id,state,mux_terminal FROM media WHERE provider='mux' AND (mux_upload_id=$1 OR provider_id=$2) FOR UPDATE",[uploadId,assetId])).rows[0];
  if(!media)return {ignored:true};
  check((!uploadId||media.mux_upload_id===uploadId)&&(!assetId||!media.provider_id||media.provider_id===assetId),409,'MUX_ASSET_MISMATCH');
  if(event.type==='video.asset.deleted'||event.type.endsWith('.errored')||event.type.endsWith('.cancelled')||event.type.endsWith('.timed_out')) {
    await db.query("UPDATE media SET state='failed',mux_terminal=true WHERE id=$1",[media.id]);return {state:'failed'};
  }
  check(assetId,400,'INVALID_MUX_EVENT');return updateFromAsset(db,media,assetId,fetcher);
}
// Called only after session/browser/approval/content entitlement checks in the API transaction.
export async function authorizedMuxPlayback(db:Db,media:Video,sessionToken:string,fetcher:Fetcher=fetch) {
  const asset=await getMuxAsset(muxId.parse(media.provider_id),fetcher),privateVideo=privateAsset(asset);
  check(!media.mux_terminal&&asset.upload_id===media.mux_upload_id&&asset.passthrough===media.id&&asset.playback_ids.some(p=>p.id===media.mux_playback_id),409,'MUX_ASSET_MISMATCH');
  const session=(await db.query<{expires:number}>('SELECT EXTRACT(EPOCH FROM expires_at)::double precision AS expires FROM sessions WHERE token_hash=$1 AND revoked_at IS NULL',[hash(sessionToken)])).rows[0];
  check(session,401,'SESSION_INVALID');
  return signMuxPlayback(media.mux_playback_id!,privateVideo.duration,session.expires);
}
