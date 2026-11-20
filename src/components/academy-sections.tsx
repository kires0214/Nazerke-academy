import { copy,type SiteLocale } from '@/lib/locale';
import { academyNavigation } from '@/lib/site-navigation';
import { SectionCards } from './section-cards';

export function AcademySections({locale,all=false}:{locale:SiteLocale;all?:boolean}) {
  const t=copy(locale);
  const links=academyNavigation(locale);
  return <SectionCards links={all?links.slice(1):links.slice(2,5)} label={t('Разделы Академии','Academy sections')}/>;
}
