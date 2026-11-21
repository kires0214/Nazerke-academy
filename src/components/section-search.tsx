import Link from 'next/link';
import type { CatalogSearch } from '@/lib/catalog-search';
import { kinds,learningTracks } from '@/lib/catalog';
import { copy,type SiteLocale } from '@/lib/locale';

const kindNames = {
  section:['Раздел','Section'],course:['Курс','Course'],module:['Модуль','Module'],lesson:['Урок','Lesson'],
  attachment:['Насадка','Attachment'],recipe:['Рецепт','Recipe'],collection:['Подборка','Collection'],
  post:['Публикация','Post'],material:['Материал','Resource'],event:['Мастер-класс','Masterclass'],
} as const;

export function SectionSearch({locale,path,search,byKind=false,byTrack=false,keep={},clearHref,placeholder}:{
  locale:SiteLocale;path:string;search:CatalogSearch;byKind?:boolean;byTrack?:boolean;keep?:Record<string,string>;clearHref:string;placeholder?:string;
}) {
  const t=copy(locale);
  const active=Object.values(search).some(Boolean);
  return <form key={JSON.stringify(search)} role="search" aria-label={t('Поиск внутри раздела','Search this section')}
    className="section-search" method="GET" action={path}>
    {Object.entries(keep).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
    <label className="section-search-query">{t('Поиск','Search')}
      <input name="q" type="search" maxLength={120} defaultValue={search.q} placeholder={placeholder??t('Название материала','Material name')}/>
    </label>
    {byKind?<label>{t('Тип материала','Material type')}<select name="kind" defaultValue={search.kind??''}>
      <option value="">{t('Все типы','All types')}</option>
      {kinds.filter(kind=>kind!=='event').map(kind=><option value={kind} key={kind}>{t(kindNames[kind][0],kindNames[kind][1])}</option>)}
    </select></label>:null}
    {byTrack?<label>{t('Раздел','Section')}<select name="track" defaultValue={search.track??''}>
      <option value="">{t('Все разделы','All sections')}</option>
      {learningTracks.map(track=><option value={track} key={track}>
        {track==='ambassador'?t('Школа Амбассадора','Ambassador School'):track==='kenwood'?'Kenwood':'Braun'}
      </option>)}
    </select></label>:null}
    <label>{t('Язык','Language')}<select name="language" defaultValue={search.language??''}>
      <option value="">{t('Все языки','All languages')}</option>
      <option value="RU">{t('Русский','Russian')}</option><option value="EN">English</option>
    </select></label>
    <div className="section-search-actions">
      <button type="submit" className="btn btn-dark">{t('Найти','Search')}</button>
      {active?<Link className="btn btn-outline" href={clearHref}>{t('Сбросить','Clear')}</Link>:null}
    </div>
  </form>;
}
