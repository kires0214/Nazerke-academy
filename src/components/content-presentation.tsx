import Link from 'next/link';
import type { Content } from '@/lib/content';
import { DownloadButton } from './actions';
import { PageHead,Photo,RichText,contentHref } from './cards';
import { VideoPlayer } from './video-player';
import { eventTimeZone } from '@/lib/event-time';
import { contentLang,copy,type SiteLocale } from '@/lib/locale';

export type PresentationMedia={id:string;kind:string;state:string};
const richSections={
  assembly:['Сборка','Assembly'],usage:['Применение','Use'],care:['Уход','Care'],mistakes:['Частые ошибки','Common mistakes'],settings:['Параметры Kenwood','Kenwood settings'],
} as const;
const listSections={
  ingredients:['Ингредиенты','Ingredients'],steps:['Приготовление','Method'],shoppingList:['Общий список покупок','Shopping list'],prepPlan:['План подготовки','Preparation plan'],
} as const;

export function ContentPresentation({node,media,apiBase='/api/media',locale='ru'}:{
  node:Content;media:PresentationMedia[];apiBase?:string;locale?:SiteLocale;
}) {
  const t=copy(locale),lang=contentLang(node.language);
  const heroImage=media.find(file=>file.kind==='image'&&file.state==='ready');
  return <>
    <PageHead title={node.title} description={node.description} kicker={'JUICY · '+(node.language==='KZ'?'Архивный язык':node.language)} lang={lang}/>
    {node.cover?<div className={'article-photo'+(node.kind==='attachment'?' product':'')}><Photo name={node.cover} alt={node.title} priority/></div>:
      heroImage?<div className="article-photo"><img src={`${apiBase}/${heroImage.id}/file`} alt={node.title}/></div>:null}
    <div className="pills">
      {node.data.duration?<span>{node.data.duration} {t('мин','min')}</span>:null}
      {node.data.portions?<span>{node.data.portions} {t('порции','servings')}</span>:null}
      {node.data.model?<span>{node.data.model}</span>:null}
    </div>
    <div lang={lang}><RichText text={node.data.body}/></div>
    {(Object.keys(richSections) as (keyof typeof richSections)[]).map(key=>node.data[key]?
      <section className="info-box" key={key}><h2>{t(richSections[key][0],richSections[key][1])}</h2><div lang={lang}><RichText text={node.data[key]}/></div></section>:null)}
    {(Object.keys(listSections) as (keyof typeof listSections)[]).map(key=>{
      if(!node.data[key]?.length)return null;
      const List=key==='steps'?'ol':'ul';
      return <section className="info-box" key={key}>
        <h2>{t(listSections[key][0],listSections[key][1])}</h2>
        <List lang={lang}>{node.data[key].map((line,index)=><li key={index}>{line}</li>)}</List>
      </section>;
    })}
    {media.filter(file=>file.kind==='video').map(file=><section className="info-box" key={file.id}>
      <h2>{t('Видео','Video')}</h2>{file.state==='ready'?<VideoPlayer mediaId={file.id} apiBase={apiBase}/>:
        <p>{file.state==='failed'?t('Видео недоступно.','This video is unavailable.'):t('Видео обрабатывается. Попробуйте позже.','The video is processing. Try again later.')}</p>}
    </section>)}
    {media.filter(file=>file.kind==='document'&&file.state==='ready').map(file=>
      <p key={file.id}><DownloadButton mediaId={file.id} apiBase={apiBase}/></p>)}
  </>;
}

export function EventDetails({node,remaining,children,locale='ru'}:{node:Content;remaining?:number|null;children?:React.ReactNode;locale?:SiteLocale}) {
  const t=copy(locale);
  return <section className="info-box">
    {node.data.city?<h2>{node.data.city}</h2>:null}
    <p>{node.data.venueAddress||t('Адрес уточняется','Address to be confirmed')}</p>
    <p>{node.data.startsAt?<time dateTime={node.data.startsAt}>{new Date(node.data.startsAt).toLocaleString(locale,{timeZone:eventTimeZone})}</time>:t('Дата уточняется','Date to be confirmed')}</p>
    {remaining!=null?<p>{remaining>0?t(`Свободно мест: ${remaining} из ${node.data.capacity}`,`Seats available: ${remaining} of ${node.data.capacity}`):t('Мест нет, доступен лист ожидания','Fully booked. You can join the waitlist.')}</p>:
      node.data.capacity?<p>{t('Всего мест','Total seats')}: {node.data.capacity}</p>:null}
    {children}
  </section>;
}

export function ContentProgram({node,nodes,completed,linkFor=contentHref,locale='ru'}:{
  node:Content;nodes:Content[];completed?:ReadonlySet<string>;linkFor?:(node:Content)=>string;locale?:SiteLocale;
}) {
  const t=copy(locale);
  const modules=node.kind==='course'?nodes.filter(child=>child.kind==='module'&&child.parent_id===node.id):
    node.kind==='module'?[node]:[];
  const lessons=nodes.filter(child=>child.kind==='lesson'&&modules.some(module=>module.id===child.parent_id));
  if(!lessons.length)return null;
  const done=lessons.filter(lesson=>completed?.has(lesson.id)).length;
  return <section className="section">
    <h2>{t('Уроки программы','Course lessons')}</h2>
    {completed?<><p>{t(`${done} из ${lessons.length} завершено`,`${done} of ${lessons.length} completed`)}</p><progress value={done} max={lessons.length} aria-label={t('Прогресс курса','Course progress')}/></>:null}
    {modules.map(module=><section key={module.id}>
      <h3 lang={contentLang(module.language)}>{module.title}</h3>
      <div className="course-steps">
        {lessons.filter(lesson=>lesson.parent_id===module.id).map(lesson=>
          <Link key={lesson.id} className="step" href={linkFor(lesson)} lang={contentLang(lesson.language)}>{completed?.has(lesson.id)?'✓ ':''}{lesson.title} →</Link>)}
      </div>
    </section>)}
  </section>;
}
