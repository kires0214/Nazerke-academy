'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function messageFor(code:string) {
  return ({PERMISSION_DENIED:'Недостаточно прав.',APPROVAL_REQUIRED:'Доступ ожидает подтверждения.',SESSION_INVALID:'Войдите снова.',LOGIN_REQUIRED:'Войдите в аккаунт.',
    CONTENT_CHANGED_RELOAD:'Материал изменился. Обновите страницу.',COMPLETE_EARLIER_LESSONS:'Сначала завершите предыдущие уроки.',
    RATE_LIMITED:'Слишком много запросов. Попробуйте немного позже.',INVALID_INPUT:'Проверьте заполненные поля.',
    MEDIA_NOT_READY:'Видео ещё обрабатывается.',PRIVATE_VIDEO_NOT_READY:'Видео пока недоступно.',
    MUX_NOT_CONFIGURED:'Видеосервис пока не подключён.',MUX_SIGNING_NOT_CONFIGURED:'Видеосервис пока не подключён.',
    MUX_MUST_BE_PRIVATE:'Видео пока недоступно.',MUX_VIDEO_REQUIRED:'Видео необходимо перенести в новый видеосервис.',
    MUX_QUALITY_MISMATCH:'Видео пока недоступно.',SESSION_EXPIRES_SOON:'Войдите снова, чтобы продолжить урок.',
    VIDEO_BROWSER_UNSUPPORTED:'Откройте урок в браузере с поддержкой видео HLS.',EVENT_CLOSED:'Запись на встречу закрыта.',
    BROWSER_REGISTERED_CONTACT_SUPPORT:'Аккаунт привязан к другому браузеру. Обратитесь в поддержку.',
    TELEGRAM_CODE_INVALID:'Код истёк или уже использован. Запросите новый код в Telegram.',
    INVITE_REQUIRED:'Для входа нужно приглашение команды JUICY.',
    PUBLISH_PARENT_FIRST:'Сначала опубликуйте родительский курс или модуль.',
    PARENT_AUDIENCE_MISMATCH:'Выберите тот же доступ, что у родительского курса или модуля.',
    RECIPE_DETAILS_REQUIRED:'Для публикации рецепта заполните время, порции, ингредиенты и шаги.',
    EVENT_DETAILS_REQUIRED:'Для публикации встречи укажите город, дату и количество мест.',
    PRIVATE_CONTENT_KIND:'Этот материал можно открыть только Академии или амбассадорам.',
    PUBLIC_VIDEO_FORBIDDEN:'Удалите видео из материала или измените его доступ на закрытый.',
    ALREADY_EXISTS:'Такой адрес уже используется. Укажите другой адрес.',
  } as Record<string,string>)[code]??'Не удалось выполнить действие. Попробуйте позже или обратитесь в поддержку.';
}
export async function apiCall(url:string,payload:unknown,method='POST',signal?:AbortSignal) {
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin',signal});
  const result=await response.json(); if(!response.ok) throw new Error(messageFor(result.error));return result;
}
export function ActionButton({url,payload,label,method='POST',goTo}:{url:string;payload?:unknown;label:string;method?:string;goTo?:string}) {
  const [pending,setPending]=useState(false),[status,setStatus]=useState(''); const router=useRouter();
  return <span className="action-control"><button className="btn btn-dark" type="button" disabled={pending} onClick={async()=>{
    setPending(true);setStatus('');try {const result=await apiCall(url,payload??{},method);setStatus(result.status==='waitlist'?'Вы в листе ожидания.':'Сохранено.');if(goTo)router.push(goTo);router.refresh();} catch(error){setStatus((error as Error).message);} finally{setPending(false);}
  }}>{pending?'Сохраняем…':label}</button><span role="status">{status}</span></span>;
}
export function TelegramCodeForm() {
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);
  return <form className="form-stack" onSubmit={async event=>{
    event.preventDefault();
    if(pending)return;
    const code=String(new FormData(event.currentTarget).get('code')??'').trim();
    setStatus('');
    setPending(true);
    try {
      const {destination}=await apiCall('/api/auth/telegram',{code});
      window.location.assign(destination==='/admin'?'/admin':'/academy');
    }catch(error){
      setStatus((error as Error).message);
      setPending(false);
    }
  }}>
    <label>Код из Telegram<input name="code" required minLength={12} maxLength={12} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false}/></label>
    <button type="submit" className="btn btn-dark" disabled={pending}>{pending?'Проверяем…':'Войти'}</button>
    <p role="status">{status}</p>
  </form>;
}
export function SupportForm({threadId}:{threadId?:string}) {
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);const router=useRouter();
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const body=String(new FormData(form).get('body')??'');setPending(true);try{await apiCall(threadId?'/api/studio/support':'/api/support',threadId?{threadId,body}:{body});setStatus('Сообщение отправлено. Ответит сотрудник JUICY.');form.reset();router.refresh();}catch(error){setStatus((error as Error).message);}finally{setPending(false);}}}>
    <label>Сообщение<textarea name="body" rows={4} maxLength={3900} required/></label><button className="btn btn-dark" disabled={pending}>{pending?'Отправляем…':'Отправить'}</button><p role="status">{status}</p>
  </form>;
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
