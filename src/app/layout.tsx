import type { Metadata } from 'next';
import { siteLocale } from '@/lib/site-locale';
import { copy } from '@/lib/locale';
import './globals.css';
export async function generateMetadata():Promise<Metadata>{
  const t=copy(await siteLocale());
  return {title:{default:'JUICY by Nazerke',template:'%s · JUICY'},description:t('Кулинарная академия Назерке. Готовим с уверенностью.','Nazerke’s cooking academy. Cook with confidence.')};
}
export default async function RootLayout({children}:{children:React.ReactNode}) {
  const locale=await siteLocale(),t=copy(locale);
  return <html lang={locale}><body><a className="skip-link" href="#main">{t('К содержимому','Skip to content')}</a>{children}</body></html>;
}
