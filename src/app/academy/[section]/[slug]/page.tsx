import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ContentCards } from '@/components/cards';
import { ActionButton } from '@/components/actions';
import { ContentPresentation,ContentProgram,EventDetails,type PresentationMedia } from '@/components/content-presentation';
import { academyData,pageTokens } from '@/lib/pages';
import { withDb } from '@/lib/db';
import { principal } from '@/lib/security';
import { getContent } from '@/lib/content';
import { academyDetailKinds } from '@/lib/catalog';
import { eventsWithSeats } from '@/lib/events';
export default async function Page({params}:{params:Promise<{section:string;slug:string}>}) {
  const {section,slug}=await params,{user,nodes,progress,favorites,links}=await academyData();
  const node=nodes.find(n=>n.slug===slug&&n.kind===academyDetailKinds[section]);if(!node)notFound();
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
  return <article><Link className="small-link" href="/academy/learn">← Академия</Link>
    <ContentPresentation node={node} media={media}/>
    <div className="detail-actions"><ActionButton url="/api/favorites" payload={{contentId:node.id,enabled:!favorites.includes(node.id)}} label={favorites.includes(node.id)?'Убрать из избранного':'В избранное'}/>
    {node.kind==='lesson'?<ActionButton url="/api/progress" payload={{lessonId:node.id,position:progress.find(p=>p.lesson_id===node.id)?.position_seconds??0,completed:true}} label={progress.some(p=>p.lesson_id===node.id&&p.completed_at)?'Урок завершён ✓':'Завершить урок'}/>:null}</div>
    {node.kind==='event'?<EventDetails node={node} remaining={remaining}>
      {node.data.startsAt&&Date.parse(node.data.startsAt)>Date.now()?<div className="detail-actions">
        <ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:false}} label={remaining===0?'Встать в лист ожидания':'Записаться'}/>
        <ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:true}} label="Отменить запись"/>
      </div>:<p>Запись закрыта.</p>}
    </EventDetails>:null}
    <ContentProgram node={node} nodes={nodes} completed={completed}/>
    {related.length?<section className="section"><h2>Связанные материалы</h2><ContentCards nodes={related}/></section>:null}
  </article>;
}
