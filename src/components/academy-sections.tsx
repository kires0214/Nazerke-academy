import Link from 'next/link';
import { copy,type SiteLocale } from '@/lib/locale';

export function AcademySections({locale}:{locale:SiteLocale}) {
  const t=copy(locale);
  return <nav className="academy-sections" aria-label={t('Разделы Академии','Academy sections')}>
    <Link href="/academy/kenwood" className="step">Kenwood <span aria-hidden="true">→</span></Link>
    <Link href="/academy/braun" className="step">Braun <span aria-hidden="true">→</span></Link>
    <Link href="/academy/ambassadors" className="step">{t('Школа Амбассадора','Ambassador School')} <span aria-hidden="true">→</span></Link>
  </nav>;
}
