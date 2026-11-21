import Link from 'next/link';
import { siteCopy } from '@/lib/site-locale';
export default async function NotFound() {
  const t=await siteCopy();
  return <div className="wrap section"><h1>{t('Страница не найдена','Page not found')}</h1>
    <p>{t('Возможно, материал ещё не опубликован или недоступен вашему аккаунту.','This material may be unpublished or unavailable to your account.')}</p>
    <Link className="btn btn-dark" href="/">{t('На главную','Go home')}</Link></div>;
}
