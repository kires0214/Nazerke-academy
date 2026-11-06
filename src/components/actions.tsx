'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function messageFor(code:string) {
  return ({PERMISSION_DENIED:'Недостаточно прав.',APPROVAL_REQUIRED:'Доступ ожидает подтверждения.',SESSION_INVALID:'Войдите снова.',LOGIN_REQUIRED:'Войдите в аккаунт.',
    CONTENT_CHANGED_RELOAD:'Материал изменился. Обновите страницу.',COMPLETE_EARLIER_LESSONS:'Сначала завершите предыдущие уроки.',
    RATE_LIMITED:'Слишком много запросов. Попробуйте немного позже.',INVALID_INPUT:'Проверьте заполненные поля.',
    MEDIA_NOT_READY:'Видео ещё обрабатывается.',PRIVATE_VIDEO_NOT_READY:'Видео пока недоступно.',
    STREAM_NOT_CONFIGURED:'Видеосервис пока не подключён.',EVENT_CLOSED:'Запись на встречу закрыта.',
    BROWSER_REGISTERED_CONTACT_SUPPORT:'Аккаунт привязан к другому браузеру. Обратитесь в поддержку.',
  } as Record<string,string>)[code]??'Не удалось выполнить действие. Попробуйте позже или обратитесь в поддержку.';
}
export async function apiCall(url:string,payload:unknown,method='POST') {
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin'});
  const result=await response.json(); if(!response.ok) throw new Error(messageFor(result.error));return result;
}
export function ActionButton({url,payload,label,method='POST',goTo}:{url:string;payload?:unknown;label:string;method?:string;goTo?:string}) {
  const [pending,setPending]=useState(false),[status,setStatus]=useState(''); const router=useRouter();
  return <span className="action-control"><button className="btn btn-dark" type="button" disabled={pending} onClick={async()=>{
    setPending(true);setStatus('');try {const result=await apiCall(url,payload??{},method);setStatus(result.status==='waitlist'?'Вы в листе ожидания.':'Сохранено.');if(goTo)router.push(goTo);router.refresh();} catch(error){setStatus((error as Error).message);} finally{setPending(false);}
  }}>{pending?'Сохраняем…':label}</button><span role="status">{status}</span></span>;
}
export function TelegramWidget({bot,authUrl}:{bot:string;authUrl:string}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const host=ref.current;if(!host)return;
    const script=document.createElement('script');script.src='https://telegram.org/js/telegram-widget.js?22';script.async=true;
    script.setAttribute('data-telegram-login',bot);script.setAttribute('data-size','large');script.setAttribute('data-auth-url',authUrl);
    host.appendChild(script);return()=>{host.replaceChildren();};
  },[bot,authUrl]);
  return <div ref={ref} className="telegram-widget" aria-label="Вход через Telegram"/>;
}
export function SupportForm({threadId}:{threadId?:string}) {
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);const router=useRouter();
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const body=String(new FormData(form).get('body')??'');setPending(true);try{await apiCall(threadId?'/api/studio/support':'/api/support',threadId?{threadId,body}:{body});setStatus('Сообщение отправлено. Ответит сотрудник JUICY.');form.reset();router.refresh();}catch(error){setStatus((error as Error).message);}finally{setPending(false);}}}>
    <label>Сообщение<textarea name="body" rows={4} maxLength={3900} required/></label><button className="btn btn-dark" disabled={pending}>{pending?'Отправляем…':'Отправить'}</button><p role="status">{status}</p>
  </form>;
}
export function VideoPlayer({mediaId}:{mediaId:string}) {
  const [url,setUrl]=useState(''),[status,setStatus]=useState(''),[pending,setPending]=useState(false);
  return <div className="video-block">{url?<iframe src={url} title="Учебное видео JUICY" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="no-referrer"/>:<button className="btn btn-dark" disabled={pending} onClick={async()=>{setPending(true);try{const response=await fetch(`/api/media/${mediaId}/playback`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(messageFor(result.error));setUrl(result.url);}catch(error){setStatus((error as Error).message);}finally{setPending(false);}}}>{pending?'Открываем…':'Смотреть видео'}</button>}<p role="status">{status}</p></div>;
}
export function DownloadButton({mediaId}:{mediaId:string}) {
  const [status,setStatus]=useState('');return <span className="action-control"><button className="btn btn-outline" onClick={async()=>{
    try {const response=await fetch(`/api/media/${mediaId}/download`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(messageFor(result.error));window.location.assign(result.url);}
    catch(error){setStatus((error as Error).message);}
  }}>Скачать материал PDF</button><span role="status">{status}</span></span>;
}
export function CityInterestForm() {
  const [status,setStatus]=useState('');return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{await apiCall('/api/city-interests',{city:String(data.get('city')),topic:String(data.get('topic'))});setStatus('Ваш интерес к встрече сохранён.');}catch(error){setStatus((error as Error).message);}}}><label>Ваш город<input name="city" required maxLength={120}/></label><label>Интересующая тема<input name="topic" required maxLength={200}/></label><button className="btn btn-dark">Хочу встречу в моём городе</button><p role="status">{status}</p></form>;
}
