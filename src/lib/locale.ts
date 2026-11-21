export const localeCookie='juicy_locale';
export type SiteLocale='ru'|'en';
export const contentLanguages=['RU','EN'] as const;
export const copy=(locale:SiteLocale)=>(russian:string,english:string)=>locale==='en'?english:russian;
export const contentLang=(code:string)=>code==='EN'?'en':code==='KZ'?'kk':'ru';
