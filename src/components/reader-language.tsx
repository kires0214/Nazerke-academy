'use client';
import { createContext,useContext,type ReactNode } from 'react';
import { copy,localeCookie,type SiteLocale } from '@/lib/locale';

const ReaderLanguage=createContext<SiteLocale>('ru');
export const useReaderLocale=()=>useContext(ReaderLanguage);
export const useReaderCopy=()=>copy(useReaderLocale());

export function ReaderLanguageProvider({locale,children}:{locale:SiteLocale;children:ReactNode}) {
  return <ReaderLanguage.Provider value={locale}>{children}</ReaderLanguage.Provider>;
}

export function LanguageSwitch({locale}:{locale:SiteLocale}) {
  const next=locale==='en'?'ru':'en';
  const label=next==='en'?'Switch to English':'Переключить на русский';
  return <button type="button" className="language-switch" aria-label={label} title={label} lang={next} onClick={()=>{
    document.cookie=`${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    location.reload();
  }}>{next.toUpperCase()}</button>;
}
