import { cache } from 'react';
import { cookies } from 'next/headers';
import { copy,localeCookie,type SiteLocale } from './locale';

export const siteLocale=cache(async():Promise<SiteLocale>=>(await cookies()).get(localeCookie)?.value==='en'?'en':'ru');
export const siteCopy=async()=>copy(await siteLocale());
