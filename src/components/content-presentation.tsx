import Link from 'next/link';
import type { Content } from '@/lib/content';
import { DownloadButton } from './actions';
import { PageHead,Photo,RichText,contentHref } from './cards';
import { VideoPlayer } from './video-player';

export type PresentationMedia={id:string;kind:string;state:string};
const richSections={
  assembly:'Сборка',usage:'Применение',care:'Уход',mistakes:'Частые ошибки',settings:'Параметры Kenwood',
} as const;
const listSections={
  ingredients:'Ингредиенты',steps:'Приготовление',shoppingList:'Общий список покупок',prepPlan:'План подготовки',
} as const;

export function ContentPresentation({node,media,apiBase='/api/media'}:{
  node:Content;media:PresentationMedia[];apiBase?:string;
}) {
  const heroImage=media.find(file=>file.kind==='image'&&file.state==='ready');
  return <>
    <PageHead title={node.title} description={node.description} kicker={'JUICY · '+node.language}/>
    {node.cover?<div className={'article-photo'+(node.kind==='attachment'?' product':'')}><Photo name={node.cover} alt={node.title} priority/></div>:
      heroImage?<div className="article-photo"><img src={`${apiBase}/${heroImage.id}/file`} alt={node.title}/></div>:null}
    <div className="pills">
      {node.data.duration?<span>{node.data.duration} мин</span>:null}
      {node.data.portions?<span>{node.data.portions} порции</span>:null}
      {node.data.model?<span>{node.data.model}</span>:null}
    </div>
    <RichText text={node.data.body}/>
    {(Object.keys(richSections) as (keyof typeof richSections)[]).map(key=>node.data[key]?
      <section className="info-box" key={key}><h2>{richSections[key]}</h2><RichText text={node.data[key]}/></section>:null)}
    {(Object.keys(listSections) as (keyof typeof listSections)[]).map(key=>{
      if(!node.data[key]?.length)return null;
      const List=key==='steps'?'ol':'ul';
      return <section className="info-box" key={key}>
        <h2>{listSections[key]}</h2>
        <List>{node.data[key].map((line,index)=><li key={index}>{line}</li>)}</List>
      </section>;
    })}
    {media.filter(file=>file.kind==='video').map(file=><section className="info-box" key={file.id}>
      <h2>Видео</h2>{file.state==='ready'?<VideoPlayer mediaId={file.id} apiBase={apiBase}/>:
        <p>{file.state==='failed'?'Видео недоступно.':'Видео обрабатывается. Попробуйте позже.'}</p>}
    </section>)}
    {media.filter(file=>file.kind==='document'&&file.state==='ready').map(file=>
      <p key={file.id}><DownloadButton mediaId={file.id} apiBase={apiBase}/></p>)}
  </>;
}

export function EventDetails({node,children}:{node:Content;children?:React.ReactNode}) {
  return <section className="info-box">
    {node.data.city?<h2>{node.data.city}</h2>:null}
    <p>{node.data.startsAt?new Date(node.data.startsAt).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda'}):'Дата уточняется'}</p>
    {children}
  </section>;
}

export function ContentProgram({node,nodes,completed,linkFor=contentHref}:{
  node:Content;nodes:Content[];completed?:ReadonlySet<string>;linkFor?:(node:Content)=>string;
}) {
  const modules=node.kind==='course'?nodes.filter(child=>child.kind==='module'&&child.parent_id===node.id):
    node.kind==='module'?[node]:[];
  const lessons=nodes.filter(child=>child.kind==='lesson'&&modules.some(module=>module.id===child.parent_id));
  if(!lessons.length)return null;
  const done=lessons.filter(lesson=>completed?.has(lesson.id)).length;
  return <section className="section">
    <h2>Уроки программы</h2>
    {completed?<><p>{done} из {lessons.length} завершено</p><progress value={done} max={lessons.length} aria-label="Прогресс курса"/></>:null}
    {modules.map(module=><section key={module.id}>
      <h3>{module.title}</h3>
      <div className="course-steps">
        {lessons.filter(lesson=>lesson.parent_id===module.id).map(lesson=>
          <Link key={lesson.id} className="step" href={linkFor(lesson)}>{completed?.has(lesson.id)?'✓ ':''}{lesson.title} →</Link>)}
      </div>
    </section>)}
  </section>;
}
