'use client';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { copy,type SiteLocale } from '@/lib/locale';
import { useReaderLocale } from './reader-language';

const englishErrors:Record<string,string>={
  PERMISSION_DENIED:'You do not have permission.', APPROVAL_REQUIRED:'Your access is awaiting approval.',
  SESSION_INVALID:'Sign in again.', LOGIN_REQUIRED:'Sign in to continue.', SESSION_EXPIRES_SOON:'Sign in again to continue the lesson.',
  COMPLETE_EARLIER_LESSONS:'Finish the previous lessons first.', RATE_LIMITED:'Too many requests. Try again shortly.',
  INVALID_INPUT:'Check the information you entered.', EVENT_CLOSED:'Registration is closed.',
  MEDIA_NOT_READY:'The video is still processing.', VIDEO_BROWSER_UNSUPPORTED:'Open this lesson in a browser that supports HLS.',
  DOWNLOAD_LINK_EXPIRED:'This download link expired. Try downloading again.',
  BROWSER_REGISTERED_CONTACT_SUPPORT:'This account is registered to a different browser. Contact support.',
  TELEGRAM_CODE_INVALID:'This code has expired or was already used. Request a new code in Telegram.',
  INVITE_REQUIRED:'You need an invitation from JUICY to sign in.',
};
export function messageFor(code:string,locale:SiteLocale='ru') {
  if(locale==='en')return englishErrors[code]??'This action could not be completed. Try again or contact support.';
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
    TELEGRAM_NOT_CONFIGURED:'Бот Telegram ещё не подключён.',
    REGISTRATION_LINK_INACTIVE:'Приглашение уже использовано, отозвано или просрочено.',
    INVITE_REQUIRED:'Для входа нужно приглашение команды JUICY.',
    PUBLISH_PARENT_FIRST:'Сначала опубликуйте родительский курс или модуль.',
    PARENT_AUDIENCE_MISMATCH:'Выберите тот же доступ, что у родительского курса или модуля.',
    RECIPE_DETAILS_REQUIRED:'Для публикации рецепта заполните время, порции, ингредиенты и шаги.',
    EVENT_DETAILS_REQUIRED:'Для публикации встречи укажите город, дату и количество мест.',
    EVENT_ADDRESS_REQUIRED:'Для публикации встречи укажите адрес.',
    PRIVATE_CONTENT_KIND:'Этот материал можно открыть только Академии или амбассадорам.',
    PUBLIC_VIDEO_FORBIDDEN:'Удалите видео из материала или измените его доступ на закрытый.',
    ALREADY_EXISTS:'Такой адрес уже используется. Укажите другой адрес.',
    ACCOUNT_ARCHIVED:'Сначала восстановите аккаунт из архива.',
    ACCOUNT_NOT_ARCHIVED:'Аккаунт уже восстановлен.',
    TECHADMIN_PROTECTED:'Аккаунт Tech Admin защищён от этих действий.',
    UNPUBLISH_FIRST:'Сначала снимите материал с публикации.',
    CONTENT_IN_USE:'Материал используется в курсе, ссылках, избранном, прогрессе или записях на встречу. Его можно скрыть или архивировать.',
    MEDIA_IN_USE:'Сначала уберите файл из материалов, к которым он прикреплён.',
    MEDIA_UPLOAD_IN_PROGRESS:'Загрузка ещё завершается. Обновите статус и повторите.',
    LEGACY_MEDIA_DELETE_REQUIRED:'Этот файл хранится в прежнем видеосервисе. Обратитесь к Tech Admin.',
    GRANTS_REQUIRE_ADMIN:'Точечные права можно назначить только администратору.',
    TECHADMIN_ONLY:'Это действие доступно только Tech Admin.',
  } as Record<string,string>)[code]??'Не удалось выполнить действие. Попробуйте позже или обратитесь в поддержку.';
}
export async function apiCall(url:string,payload:unknown,method='POST',signal?:AbortSignal,locale:SiteLocale='ru') {
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin',signal});
  const result=await response.json(); if(!response.ok) throw new Error(messageFor(result.error,locale));return result;
}
export function ActionButton({url,payload,label,method='POST',goTo,confirm,variant='dark'}:{url:string;payload?:unknown;label:string;method?:string;goTo?:string;confirm?:string;variant?:'dark'|'outline'}) {
  const locale=useReaderLocale(),t=copy(locale);
  const [pending,setPending]=useState(false),[status,setStatus]=useState(''); const router=useRouter();
  return <span className="action-control"><button className={`btn btn-${variant}`} type="button" disabled={pending} onClick={async()=>{
    if(pending||confirm&&!window.confirm(confirm))return;
    setPending(true);setStatus('');try {const result=await apiCall(url,payload??{},method,undefined,locale);setStatus(method==='DELETE'?t('Удалено.','Deleted.'):result.status==='waitlist'?t('Вы в листе ожидания.','You are on the waitlist.'):t('Сохранено.','Saved.'));if(goTo)router.push(goTo);router.refresh();} catch(error){setStatus((error as Error).message);} finally{setPending(false);}
  }}>{pending?t('Сохраняем…','Saving…'):label}</button><span role="status">{status}</span></span>;
}

export function LogoutButton({inMenu=false}:{inMenu?:boolean}={}) {
  const locale=useReaderLocale(),t=copy(locale);
  const [pending,setPending]=useState(false),[status,setStatus]=useState('');
  return <div className="header-logout">
    <button type="button" className={inMenu?'profile-menu-item':'btn btn-outline'} disabled={pending} onClick={async()=>{
      if(pending)return;
      setPending(true);
      setStatus('');
      try{
        await apiCall('/api/auth/logout',{},'POST',undefined,locale);
        window.location.replace('/');
      }catch(error){
        setStatus((error as Error).message);
        setPending(false);
      }
    }}>{pending?t('Выходим…','Signing out…'):t('Выйти','Sign out')}</button>
    <span role="status">{status}</span>
  </div>;
}

export function FavoriteButton({url,target,saved,title}:{url:string;target:Record<string,string>;saved:boolean;title?:string}) {
  const router=useRouter(),locale=useReaderLocale(),t=copy(locale);
  const busy=useRef(false);
  const [pending,setPending]=useState(false),[status,setStatus]=useState('');
  const label=saved?t('Убрать из избранного','Remove from favorites'):t('В избранное','Save to favorites');
  return <div className="favorite-control">
    <button className="btn btn-outline favorite-button" type="button" disabled={pending} aria-pressed={saved}
      aria-label={title?`${label}: ${title}`:label} onClick={async()=>{
        if(busy.current)return;
        busy.current=true;setPending(true);setStatus('');
        try{await apiCall(url,{...target,enabled:!saved},'POST',undefined,locale);router.refresh();}
        catch(error){setStatus((error as Error).message);}
        finally{busy.current=false;setPending(false);}
      }}><span aria-hidden="true">{saved?'♥':'♡'}</span>{label}</button>
    {status?<p role="status">{status}</p>:null}
  </div>;
}
export function TelegramCodeForm() {
  const locale=useReaderLocale(),t=copy(locale);
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);
  return <form className="form-stack" onSubmit={async event=>{
    event.preventDefault();
    if(pending)return;
    const code=String(new FormData(event.currentTarget).get('code')??'').trim();
    setStatus('');
    setPending(true);
    try {
      const {destination}=await apiCall('/api/auth/telegram',{code},'POST',undefined,locale);
      window.location.assign(destination==='/admin'?'/admin':'/academy');
    }catch(error){
      setStatus((error as Error).message);
      setPending(false);
    }
  }}>
    <label>{t('Код из Telegram','Telegram code')}<input name="code" required minLength={12} maxLength={12} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false}/></label>
    <button type="submit" className="btn btn-dark" disabled={pending}>{pending?t('Проверяем…','Verifying…'):t('Войти','Sign in')}</button>
    <p role="status">{status}</p>
  </form>;
}
export function SupportForm({threadId}:{threadId?:string}) {
  const locale=useReaderLocale(),t=copy(locale);
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);const router=useRouter();
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const body=String(new FormData(form).get('body')??'');setPending(true);try{await apiCall(threadId?'/api/studio/support':'/api/support',threadId?{threadId,body}:{body},'POST',undefined,locale);setStatus(t('Сообщение отправлено. Ответит сотрудник JUICY.','Message sent. The JUICY team will reply.'));form.reset();router.refresh();}catch(error){setStatus((error as Error).message);}finally{setPending(false);}}}>
    <label>{t('Сообщение','Message')}<textarea name="body" rows={4} maxLength={3900} required/></label><button className="btn btn-dark" disabled={pending}>{pending?t('Отправляем…','Sending…'):t('Отправить','Send')}</button><p role="status">{status}</p>
  </form>;
}
export function DownloadButton({mediaId,apiBase='/api/media'}:{mediaId:string;apiBase?:string}) {
  const locale=useReaderLocale(),t=copy(locale);
  const [status,setStatus]=useState('');return <span className="action-control"><button className="btn btn-outline" onClick={async()=>{
    try {const response=await fetch(`${apiBase}/${mediaId}/download`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(messageFor(result.error,locale));window.location.assign(result.url);}
    catch(error){setStatus((error as Error).message);}
  }}>{t('Скачать материал PDF','Download PDF')}</button><span role="status">{status}</span></span>;
}
export function CityInterestForm() {
  const locale=useReaderLocale(),t=copy(locale);
  const [status,setStatus]=useState('');return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{await apiCall('/api/city-interests',{city:String(data.get('city')),topic:String(data.get('topic'))},'POST',undefined,locale);setStatus(t('Ваш интерес к встрече сохранён.','Your interest has been recorded.'));}catch(error){setStatus((error as Error).message);}}}><label>{t('Ваш город','Your city')}<input name="city" required maxLength={120}/></label><label>{t('Интересующая тема','Topic you are interested in')}<input name="topic" required maxLength={200}/></label><button className="btn btn-dark">{t('Хочу встречу в моём городе','Request an event in my city')}</button><p role="status">{status}</p></form>;
}
