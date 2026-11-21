import Link from 'next/link';
import { catalogGroups,sectionHref,type CatalogGroup,type LearningTrack } from '@/lib/catalog';
import { catalogUrl,type CatalogGroupFilter,type CatalogSearch } from '@/lib/catalog-search';
import { copy,type SiteLocale } from '@/lib/locale';

export function groupLabel(locale:SiteLocale,group:CatalogGroup) {
  const t=copy(locale);
  return ({training:t('Обучение','Learning'),recipes:t('Рецепты','Recipes'),attachments:t('Насадки','Attachments')})[group];
}

export function CatalogTabs({section,active,locale,search}:{section:LearningTrack;active:CatalogGroupFilter;locale:SiteLocale;search?:CatalogSearch}) {
  const t=copy(locale);
  return <nav className="catalog-tabs" aria-label={t('Подразделы','Subsections')}>
    {([...catalogGroups,'all'] as const).map(group=><Link key={group} href={catalogUrl(sectionHref(section),{...search,group})}
      className="btn btn-outline" aria-current={active===group?'page':undefined}>{group==='all'?t('Все подразделы','All subsections'):groupLabel(locale,group)}</Link>)}
  </nav>;
}
