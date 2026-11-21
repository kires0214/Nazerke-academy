'use client';

import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {copy,type SiteLocale} from '@/lib/locale';
import {LogoutButton} from './actions';
import {LanguageSwitch} from './reader-language';

export function ProfileMenu({locale,approved,studio=false}:{locale:SiteLocale;approved:boolean;studio?:boolean}) {
  const t=copy(locale);
  const details=useRef<HTMLDetailsElement>(null);
  const trigger=useRef<HTMLElement>(null);
  function close(){
    if(details.current)details.current.open=false;
  }

  useEffect(()=>{
    function onOutside(event:PointerEvent){
      const disclosure=details.current;
      if(disclosure?.open&&event.target instanceof Node&&!disclosure.contains(event.target))disclosure.open=false;
    }
    document.addEventListener('pointerdown',onOutside);
    return ()=>document.removeEventListener('pointerdown',onOutside);
  },[]);

  return <details ref={details} className="profile-menu" onKeyDown={event=>{
    if(event.key==='Escape'&&details.current?.open){close();trigger.current?.focus();}
  }}>
    <summary ref={trigger} className="header-control profile-menu-toggle">{t('Профиль','Profile')}</summary>
    <div className="profile-menu-panel">
      <Link className="profile-menu-item" href={approved?'/academy/profile':'/access'} onClick={close}>{approved?t('Мой профиль','My profile'):t('Мой доступ','My access')}</Link>
      {approved?<Link className="profile-menu-item" href="/academy/search" onClick={close}>{t('Поиск','Search')}</Link>:null}
      {studio?<Link className="profile-menu-item" href="/admin" onClick={close}>Studio</Link>:null}
      <LanguageSwitch locale={locale} inMenu/>
      <LogoutButton inMenu/>
    </div>
  </details>;
}
