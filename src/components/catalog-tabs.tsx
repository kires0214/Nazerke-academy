import Link from 'next/link';
import { catalogGroups,sectionHref,type CatalogGroup,type LearningTrack } from '@/lib/catalog';
import { copy,type SiteLocale } from '@/lib/locale';

export function groupLabel(locale:SiteLocale,group:CatalogGroup) {
  const t=copy(locale);
  return ({training:t('Обучение','Learning'),recipes:t('Рецепты','Recipes'),attachments:t('Насадки','Attachments')})[group];
}

export function CatalogTabs({section,active,locale}:{section:LearningTrack;active:CatalogGroup;locale:SiteLocale}) {
  return <nav className="catalog-tabs" aria-label={copy(locale)('Подразделы','Subsections')}>
    {catalogGroups.map(group=><Link key={group} href={`${sectionHref(section)}?group=${group}`}
      className="btn btn-outline" aria-current={active===group?'page':undefined}>{groupLabel(locale,group)}</Link>)}
  </nav>;
}
