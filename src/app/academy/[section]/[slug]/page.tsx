import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ContentCards,PageHead,Photo,RichText,contentHref } from '@/components/cards';
import { ActionButton,DownloadButton } from '@/components/actions';
import {VideoPlayer} from '@/components/video-player';
import { academyData,pageTokens } from '@/lib/pages';
import { withDb } from '@/lib/db';
import { principal } from '@/lib/security';
import { getContent } from '@/lib/content';
export default async function Page({params}:{params:Promise<{section:string;slug:string}>}) {
  const {section,slug}=await params,{user,nodes,progress,favorites,links}=await academyData();
  const route:Record<string,string>={lessons:'lesson',recipes:'recipe',attachments:'attachment',courses:'course',collections:'collection',news:'post',materials:'material',events:'event',sections:'section',modules:'module'};
  const node=nodes.find(n=>n.slug===slug&&n.kind===route[section]);if(!node)notFound();
  const tokens=await pageTokens();const media=await withDb(async db=>{const actor=await principal(db,tokens);await getContent(db,node.id,actor);return (await db.query<{id:string;kind:string;state:string}>('SELECT m.id,m.kind,m.state FROM media m JOIN content_media l ON l.media_id=m.id WHERE l.content_id=$1',[node.id])).rows;});
  const related=nodes.filter(n=>links.some(l=>l.source_id===node.id&&l.target_id===n.id||l.target_id===node.id&&l.source_id===n.id));
  const children=nodes.filter(n=>n.parent_id===node.id);
  const lessons=node.kind==='course'?nodes.filter(n=>n.kind==='lesson'&&children.some(m=>m.id===n.parent_id)):children.filter(n=>n.kind==='lesson');
  const completed=lessons.filter(n=>progress.some(p=>p.lesson_id===n.id&&p.completed_at)).length;
  return <article><Link className="small-link" href="/academy/learn">← Академия</Link><PageHead title={node.title} description={node.description} kicker={'JUICY · '+node.language}/>
    {node.cover?<div className={'article-photo'+(node.kind==='attachment'?' product':'')}><Photo name={node.cover} alt={node.title} priority/></div>:media.some(m=>m.kind==='image')?<div className="article-photo"><img src={'/api/media/'+media.find(m=>m.kind==='image')!.id+'/file'} alt={node.title}/></div>:null}
    <div className="pills">{node.data.duration?<span>{node.data.duration} мин</span>:null}{node.data.portions?<span>{node.data.portions} порции</span>:null}{node.data.model?<span>{node.data.model}</span>:null}</div>
    <RichText text={node.data.body}/>
    {['assembly','usage','care','mistakes','settings'].map(key=>{const labels:Record<string,string>={assembly:'Сборка',usage:'Применение',care:'Уход',mistakes:'Частые ошибки',settings:'Параметры Kenwood'};const text=node.data[key as keyof typeof node.data];return typeof text==='string'&&text?<section className="info-box" key={key}><h2>{labels[key]}</h2><RichText text={text}/></section>:null;})}
    {(['ingredients','steps','shoppingList','prepPlan'] as const).map(key=>node.data[key]?.length?<section className="info-box" key={key}><h2>{{ingredients:'Ингредиенты',steps:'Приготовление',shoppingList:'Общий список покупок',prepPlan:'План подготовки'}[key]}</h2>{key==='steps'?<ol>{node.data[key].map((line,i)=><li key={i}>{line}</li>)}</ol>:<ul>{node.data[key].map((line,i)=><li key={i}>{line}</li>)}</ul>}</section>:null)}
    {media.filter(m=>m.kind==='video').map(m=><section className="info-box" key={m.id}><h2>Видео</h2>{m.state==='ready'?<VideoPlayer mediaId={m.id}/>:<p>Видео обрабатывается. Попробуйте позже.</p>}</section>)}
    {media.filter(m=>m.kind==='document').map(m=><p key={m.id}><DownloadButton mediaId={m.id}/></p>)}
    <div className="detail-actions"><ActionButton url="/api/favorites" payload={{contentId:node.id,enabled:!favorites.includes(node.id)}} label={favorites.includes(node.id)?'Убрать из избранного':'В избранное'}/>
    {node.kind==='lesson'?<ActionButton url="/api/progress" payload={{lessonId:node.id,position:progress.find(p=>p.lesson_id===node.id)?.position_seconds??0,completed:true}} label={progress.some(p=>p.lesson_id===node.id&&p.completed_at)?'Урок завершён ✓':'Завершить урок'}/>:null}</div>
    {node.kind==='event'?<section className="info-box"><h2>{node.data.city}</h2><p>{node.data.startsAt?new Date(node.data.startsAt).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda'}):'Дата уточняется'}</p><ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:false}} label="Записаться / лист ожидания"/><ActionButton url={`/api/events/${node.id}/register`} payload={{cancel:true}} label="Отменить запись"/></section>:null}
    {lessons.length?<section className="section"><h2>Уроки программы</h2><p>{completed} из {lessons.length} завершено</p><progress value={completed} max={lessons.length} aria-label="Прогресс курса"/>{(node.kind==='course'?children:[node]).map(module=><section key={module.id}><h3>{module.title}</h3><div className="course-steps">{lessons.filter(n=>n.parent_id===module.id).map(n=><Link key={n.id} className="step" href={contentHref(n)}>{progress.some(p=>p.lesson_id===n.id&&p.completed_at)?'✓ ':''}{n.title} →</Link>)}</div></section>)}</section>:null}
    {related.length?<section className="section"><h2>Связанные материалы</h2><ContentCards nodes={related}/></section>:null}
  </article>;
}
