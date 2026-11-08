// Browser-only helpers. Playback credentials stay in memory, never localStorage.
export type PlaybackLease={url:string;issuedAt:number;expiresAt:number;durationSeconds:number};
export async function putDirectVideo(url:string,file:Blob,signal:AbortSignal,fetcher:typeof fetch=fetch) {
  const target=new URL(url);
  if(target.origin!=='https://storage.googleapis.com'||target.username||target.password)throw new Error('UNSAFE_UPLOAD_URL');
  const response=await fetcher(target,{method:'PUT',body:file,headers:{'Content-Type':file.type||'application/octet-stream'},credentials:'omit',signal});
  if(!response.ok)throw new Error('DIRECT_UPLOAD_FAILED');
}
export function validateLease(value:PlaybackLease):PlaybackLease {
  const url=new URL(value.url);
  if(url.origin!=='https://stream.mux.com'||!/^\/[A-Za-z0-9_-]+\.m3u8$/.test(url.pathname)||
    !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(url.searchParams.get('token')??'')||
    !Number.isFinite(value.durationSeconds)||value.durationSeconds<=0||value.durationSeconds>7200||
    !Number.isFinite(value.issuedAt)||!Number.isFinite(value.expiresAt)||value.expiresAt<=value.issuedAt||value.expiresAt-value.issuedAt>15300)
    throw new Error('INVALID_PLAYBACK_LEASE');
  return value;
}
export function leaseNeedsRenewal(lease:PlaybackLease,receivedAt:number,position:number,rate:number,now=Date.now()) {
  const left=lease.expiresAt-lease.issuedAt-Math.max(0,now-receivedAt)/1000;
  return left<Math.max(120,(lease.durationSeconds-position)/Math.max(0.5,rate)+120);
}
// Hls.js reuses the video and buffered media; only subsequent signed Mux requests get a new JWT.
export function refreshMuxRequest(request:string,leaseUrl:string) {
  const url=new URL(request),lease=new URL(leaseUrl);
  if(lease.origin==='https://stream.mux.com'&&url.protocol==='https:'&&
    (url.hostname==='mux.com'||url.hostname.endsWith('.mux.com'))&&url.searchParams.has('token'))
    url.searchParams.set('token',lease.searchParams.get('token')??'');
  return url.toString();
}
export function replaceNativeSource(video:HTMLVideoElement,url:string,signal:AbortSignal) {
  const position=video.currentTime,wasPlaying=!video.paused;
  video.addEventListener('loadedmetadata',()=>{
    if(signal.aborted)return;
    video.currentTime=position;
    if(wasPlaying)void video.play().catch(()=>{});
  },{once:true,signal});
  video.src=url;video.load();
}
