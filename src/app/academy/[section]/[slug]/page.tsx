import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ContentCards,PageHead } from '@/components/cards';
import { ActionButton,FavoriteButton } from '@/components/actions';
import { groupLabel } from '@/components/catalog-tabs';
import { ContentPresentation,ContentProgram,EventDetails,type PresentationMedia } from '@/components/content-presentation';
import { academyData,pageTokens } from '@/lib/pages';
import { withDb } from '@/lib/db';
import { principal } from '@/lib/security';
import { getContent } from '@/lib/content';
import { academyDetailKinds,groupFor,sectionFor,sectionHref,trackLabels } from '@/lib/catalog';
import { eventsWithSeats } from '@/lib/events';
import { siteLocale } from '@/lib/site-locale';
import { copy } from '@/lib/locale';
export default async function Page({params}:{params:Promise<{section:string;slug:string}>}) {
  const [{section,slug},{nodes,catalog,progress,favorites,links},locale]=await Promise.all([params,academyData(),siteLocale()]);
  const t=copy(locale);
  const card=catalog.find(node=>node.slug===slug&&node.kind===academyDetailKinds[section]);
  if(!card||section==='offers'&&card.data.postKind!=='offer')notFound();
  const parent=catalog.find(node=>node.id===card.parent_id);
  const root=catalog.find(node=>node.id===parent?.parent_id)??parent??card;
  const track=sectionFor(root.audience,root.data),group=groupFor(root.kind,root.data);
  const location=track==='ambassador'?t('Школа Амбассадора','Ambassador School'):trackLabels[track];
  const back=card.kind==='event'?{href:'/academy/events',label:t('Мастер-классы','Masterclasses')}:
    card.data.postKind==='offer'?{href:'/academy/offers',label:t('Акции','Offers')}:
    {href:`${sectionHref(track)}?group=${group}`,label:`${location} / ${groupLabel(locale,group)}`};
  const subnav=<Link className="btn btn-outline btn-small catalog-back" href={back.href}>← {back.label}</Link>;
  if(card.locked)return <>
    {subnav}
    <PageHead title={card.title}/>
    <p className="info-box">{t('Для открытия материала нужен учебный допуск. Обратитесь в поддержку JUICY.','You need access to this material. Contact JUICY support.')}</p>
    <Link className="btn btn-dark" href="/academy/contacts">{t('Связаться с поддержкой','Contact support')}</Link>
  </>;
  const node=card;
  const tokens=await pageTokens();
  const {media,remaining}=await withDb(async db=>{
    const actor=await principal(db,tokens);
    const current=await getContent(db,node.id,actor);
    const media=(await db.query<PresentationMedia>('SELECT m.id,m.kind,m.state FROM media m JOIN content_media l ON l.media_id=m.id WHERE l.content_id=$1',[node.id])).rows;
    const [event]=await eventsWithSeats(db,[current]);
    return {media,remaining:event?.remaining};
  });
  const related=nodes.filter(n=>links.some(l=>l.source_id===node.id&&l.target_id===n.id||l.target_id===node.id&&l.source_id===n.id));
  const completed=new Set(progress.filter(p=>p.completed_at).map(p=>p.lesson_id));
  return <article>{subnav}
    <ContentPresentation node={node} media={media} locale={locale}/>
    <div className="detail-actions"><FavoriteButton url="/api/favorites" target={{contentId:node.id}} saved={favorites.includes(node.id)}/>
    {node.kind==='lesson'?<ActionButton url="/api/progress" payload={{lessonId:node.id,position:progress.find(p=>p.lesson_id===node.id)?.position_seconds??0,completed:true}} label={progress.some(p=>p.lesson_id===node.id&&p.completed_at)?t('Урок завершён ✓','Lesson completed ✓'):t('Завершить урок','Complete lesson')}/>:null}</div>
    {node.kind==='event'?<EventDetails node={node} remaining={remaining} locale={locale}>
      {node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now()?<div className="detail-actions">
        <ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:false}} label={remaining===0?t('Встать в лист ожидания','Join the waitlist'):t('Записаться','Book a seat')}/>
        <ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:true}} label={t('Отменить запись','Cancel booking')}/>
      </div>:<p>{t('Запись закрыта.','Registration is closed.')}</p>}
    </EventDetails>:null}
    <ContentProgram node={node} nodes={nodes} completed={completed} locale={locale}/>
    {related.length?<section className="section"><h2>{t('Связанные материалы','Related materials')}</h2><ContentCards nodes={related} locale={locale}/></section>:null}
  </article>;
}
