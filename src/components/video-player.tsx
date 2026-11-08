'use client';
import {useEffect,useRef,useState} from 'react';
import type Hls from 'hls.js';
import {leaseNeedsRenewal,refreshMuxRequest,replaceNativeSource,validateLease,type PlaybackLease} from '@/lib/video-client';
import {messageFor} from './actions';

class PlaybackError extends Error {constructor(public status:number,code:string){super(messageFor(code));}}
export function VideoPlayer({mediaId}:{mediaId:string}) {
  const videoRef=useRef<HTMLVideoElement>(null),startRef=useRef<()=>Promise<void>>(async()=>{});
  const [opened,setOpened]=useState(false),[pending,setPending]=useState(false),[status,setStatus]=useState('');
  useEffect(()=>{
    const video=videoRef.current!;const abort=new AbortController();
    let hls:Hls|null=null,lease:PlaybackLease|null=null,receivedAt=0,inFlight:Promise<void>|null=null,blocked=false,epoch=0,recovery=false;
    async function request(path:string) {
      const response=await fetch('/api/media/'+mediaId+'/'+path,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])});
      const value=await response.json();if(!response.ok)throw new PlaybackError(response.status,value.error);return value;
    }
    function failure(error:unknown) {
      if(abort.signal.aborted)return;
      if(error instanceof PlaybackError&&[401,403,409].includes(error.status)) {
        epoch++;blocked=true;video.pause();hls?.destroy();hls=null;video.removeAttribute('src');video.load();lease=null;setOpened(false);
      }
      setStatus(error instanceof PlaybackError?error.message:'Не удалось обновить видео. Проверьте соединение и повторите.');
    }
    async function renew(force=false) {
      if(inFlight)return inFlight;
      if(!force&&lease&&!leaseNeedsRenewal(lease,receivedAt,video.currentTime,video.playbackRate))return;
      const generation=epoch;
      inFlight=(async()=>{
        const next=validateLease(await request('playback'));if(abort.signal.aborted||generation!==epoch)return;
        const initial=!lease;lease=next;receivedAt=Date.now();blocked=false;
        if(video.canPlayType('application/vnd.apple.mpegurl'))replaceNativeSource(video,next.url,abort.signal);
        else if(initial||!hls) {
          const {default:Hls}=await import('hls.js');if(abort.signal.aborted)return;
          if(!Hls.isSupported())throw new PlaybackError(409,'VIDEO_BROWSER_UNSUPPORTED');
          hls?.destroy();hls=new Hls({enableWorker:false,xhrSetup(xhr,url){if(lease)xhr.open('GET',refreshMuxRequest(url,lease.url),true);else xhr.abort();}});
          hls.on(Hls.Events.ERROR,(_event,data)=>{
            if(!data.fatal||abort.signal.aborted)return;
            recovery=true;video.pause();setStatus('Соединение с видео прервано. Нажмите «Продолжить» — позиция сохранена.');
          });
          hls.loadSource(next.url);hls.attachMedia(video);
        }
        // Hls.js renewal updates lease above without replacing its source or clearing its buffer.
        setStatus('');setOpened(true);
      })().finally(()=>{inFlight=null;});
      return inFlight;
    }
    async function checkAccess() {await request('access');}
    startRef.current=async()=>{
      if(abort.signal.aborted)return;setPending(true);
      try {
        if(lease&&!blocked&&!recovery&&!leaseNeedsRenewal(lease,receivedAt,video.currentTime,video.playbackRate))await checkAccess();
        else await renew(true);
        if(hls&&lease&&recovery) {const position=video.currentTime;hls.loadSource(lease.url);hls.startLoad(position);recovery=false;}
        await video.play().catch(()=>{});
      }catch(error){failure(error);}finally{if(!abort.signal.aborted)setPending(false);}
    };
    const onPlay=()=>{
      if(!lease||blocked){video.pause();return;}
      if(leaseNeedsRenewal(lease,receivedAt,video.currentTime,video.playbackRate)) {
        video.pause();void renew().then(()=>video.play()).catch(failure);
      }
    };
    const validate=async()=>{if(!lease)return;if(leaseNeedsRenewal(lease,receivedAt,video.currentTime,video.playbackRate))await renew();else await checkAccess();};
    const onVisible=()=>{if(document.visibilityState==='visible')void validate().catch(failure);};
    video.addEventListener('play',onPlay);document.addEventListener('visibilitychange',onVisible);
    const timer=setInterval(()=>{void validate().catch(failure);},30000);
    return()=>{
      abort.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);video.removeEventListener('play',onPlay);
      hls?.destroy();video.pause();video.removeAttribute('src');video.load();lease=null;startRef.current=async()=>{};
    };
  },[mediaId]);
  return <div className="video-block">
    <video ref={videoRef} hidden={!opened} controls playsInline preload="none" aria-label="Учебное видео JUICY"/>
    <button type="button" className="btn btn-dark" disabled={pending} onClick={()=>void startRef.current()}>{pending?'Открываем…':opened?'Продолжить':'Смотреть видео'}</button>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
