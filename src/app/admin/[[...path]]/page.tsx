import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CmsEditor,MediaUpload } from '@/components/cms-editor';
import { StaffControls } from '@/components/staff-controls';
import { ActionButton,SupportForm } from '@/components/actions';
import { RichText } from '@/components/cards';
import { withDb } from '@/lib/db';
import { pageTokens,studioData } from '@/lib/pages';
import { hasGrant,isStudioRole,principal,requireGrant } from '@/lib/security';
import { canEditContent,kinds,listContent } from '@/lib/content';
import { supportHistory } from '@/lib/support';
import { check } from '@/lib/errors';
import { pendingRegistrationRequests } from '@/lib/telegram-access';
const contentSections=[
  {slug:'',label:'Все материалы',kinds:[]},
  {slug:'courses',label:'Курсы и уроки',kinds:['course','module','lesson']},
  {slug:'recipes',label:'Рецепты и подборки',kinds:['recipe','attachment','collection']},
  {slug:'sections',label:'Разделы и файлы',kinds:['section','material']},
  {slug:'announcements',label:'Статьи и анонсы',kinds:['post']},
  {slug:'events',label:'Мастер-классы',kinds:['event']},
];
const contentStatuses={draft:'Черновик',published:'Опубликовано',hidden:'Снято с публикации',archived:'В архиве'};
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  await studioData();
  const path=(await params).path??[],tokens=await pageTokens();
  return withDb(async db=>{
    const user=await principal(db,tokens);check(isStudioRole(user.role),403,'STAFF_REQUIRED');
    const contentSection=path.length<=1?contentSections.find(section=>section.slug===(path[0]??'')):undefined;
    if(contentSection) {
      if(!hasGrant(user,'content.read')) return <><h1>JUICY Studio</h1><p>Откройте доступный раздел в меню.</p></>;
      const nodes=await listContent(db,user,true);
      const displayed=contentSection.kinds.length?nodes.filter(node=>contentSection.kinds.includes(node.kind)):nodes;
      return <>
        <div className="section-heading studio-heading"><h1>{contentSection.slug?contentSection.label:'Контент'}</h1>{hasGrant(user,'content.edit')?<Link className="btn btn-dark" href="/admin/new">Создать материал</Link>:null}</div>
        <nav className="studio-content-nav" aria-label="Виды материалов">
          {contentSections.map(section=><Link key={section.slug} href={section.slug?'/admin/'+section.slug:'/admin'} aria-current={section===contentSection?'page':undefined}>{section.label}</Link>)}
        </nav>
        {displayed.length?<div className="course-steps">{displayed.map(node=>{
          const editable=canEditContent(user,node.kind,node.status);
          return <Link className="step" key={node.id} href={`/admin/${editable?'edit':'preview'}/${node.id}`}>
            <div className="step-body"><strong>{node.title}</strong><small>{node.language} · {contentStatuses[node.status]} · порядок {node.sort_order}</small></div>
            <span className="small-link">{editable?'Редактировать':'Открыть'}</span>
          </Link>;
        })}</div>:<p className="empty">В этом разделе пока нет материалов.</p>}
      </>;
    }
    if(['new','edit','preview'].includes(path[0])) {
      requireGrant(user,'content.read');if(path[0]!=='preview')requireGrant(user,'content.edit');
      const nodes=await listContent(db,user,true),node=nodes.find(n=>n.id===path[1]);if(path[0]!=='new'&&!node)notFound();
      const editable=node?canEditContent(user,node.kind,node.status):hasGrant(user,'content.edit');
      if(path[0]==='preview') return <><p className="notes">Предпросмотр Studio · {contentStatuses[node!.status]}</p><h1>{node!.title}</h1><p>{node!.description}</p><RichText text={node!.data.body}/>
        <Link href={editable?'/admin/edit/'+node!.id:'/admin'}>{editable?'Вернуться к редактированию →':'Все материалы →'}</Link></>;
      if(!editable)return <><h1>Редактирование недоступно</h1><p>Для этого материала нужны дополнительные права.</p><Link href={'/admin/preview/'+node!.id}>Открыть предпросмотр</Link></>;
      const media=(await db.query<{id:string;kind:string;state:string}>('SELECT id,kind,state FROM media ORDER BY created_at DESC LIMIT 200')).rows;
      const links=node?(await db.query<{target_id:string}>('SELECT target_id FROM content_links WHERE source_id=$1',[node.id])).rows.map(l=>l.target_id):[];
      const mediaIds=node?(await db.query<{media_id:string}>('SELECT media_id FROM content_media WHERE content_id=$1',[node.id])).rows.map(l=>l.media_id):[];
      return <><p><Link className="small-link" href="/admin">← Все материалы</Link></p><h1>{node?node.title:'Новый материал'}</h1>
        {node?<p><Link className="btn btn-outline" href={'/admin/preview/'+node.id}>Предпросмотр</Link></p>:null}
        <CmsEditor key={node?.id??'new'} node={node} nodes={nodes} media={media} links={links} mediaIds={mediaIds}
          allowedKinds={kinds.filter(kind=>canEditContent(user,kind))} canPublish={hasGrant(user,'content.publish')} canArchive={hasGrant(user,'content.delete')}/>
      </>;
    }
    if(path[0]==='users') {
      requireGrant(user,'students.read');
      const requests=await pendingRegistrationRequests(db,user);
      const users=(await db.query<{id:string;display_name:string;status:string;role:string}>("SELECT id,display_name,status,role FROM users WHERE $1::boolean OR role IN ('student','ambassador') ORDER BY created_at DESC LIMIT 200",[user.role==='techadmin'])).rows;
      const allGrants=user.role==='techadmin'?(await db.query<{user_id:string;permission:string}>('SELECT user_id,permission FROM admin_grants')).rows:[];
      return <><h1>Доступ в академию</h1><h2>Заявки на приглашение</h2>
        {requests.length===0?<p>Новых заявок нет.</p>:requests.map(request=><section className="info-box" key={request.id}>
          <h3>{request.display_name}</h3><p>{request.phone}</p>
          {hasGrant(user,'students.approve')?<div className="detail-actions">
            <ActionButton url={'/api/studio/registration/'+request.id} payload={{action:'invite'}} label="Пригласить"/>
            <ActionButton url={'/api/studio/registration/'+request.id} payload={{action:'decline'}} label="Отклонить"/>
          </div>:null}
        </section>)}
        <h2>Аккаунты</h2>{users.map(u=><section className="info-box" key={u.id}><h3>{u.display_name}</h3><p>{u.status} · {u.role}</p><div className="detail-actions">
        {u.status==='pending'&&hasGrant(user,'students.approve')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'approve'}} label="Подтвердить доступ"/>:null}
        {u.role!=='techadmin'&&hasGrant(user,'students.block')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'block'}} label="Заблокировать"/>:null}
        {u.role!=='techadmin'&&hasGrant(user,'devices.reset')?<ActionButton url={'/api/studio/devices/'+u.id} label="Сбросить браузер"/>:null}
        {['student','ambassador'].includes(u.role)&&hasGrant(user,'ambassadors.assign')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'ambassador',enabled:u.role!=='ambassador'}} label={u.role==='ambassador'?'Снять допуск амбассадора':'Назначить амбассадором'}/>:null}
        {user.role==='techadmin'&&u.role!=='techadmin'?<><ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:true}} label="Дать учебный допуск"/><ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:false}} label="Снять учебный допуск"/></>:null}</div>
        {user.role==='techadmin'&&u.role!=='techadmin'?<StaffControls id={u.id} role={u.role} currentGrants={allGrants.filter(g=>g.user_id===u.id).map(g=>g.permission)}/>:null}</section>)}</>;
    }
    if(path[0]==='media') {requireGrant(user,'media.upload');const media=(await db.query<{id:string;kind:string;state:string}>('SELECT id,kind,state FROM media ORDER BY created_at DESC LIMIT 200')).rows;return <><h1>Медиа</h1><MediaUpload/>{media.map(m=><div className="info-box" key={m.id}><p>{m.kind} · {m.state} · {m.id.slice(0,8)}</p>{m.kind==='video'?<ActionButton url={'/api/studio/media/'+m.id+'/refresh'} label="Обновить статус"/>:null}</div>)}</>;}
    if(path[0]==='support') {
      const messages=await supportHistory(db,user,true),threads=[...new Set(messages.map(m=>String(m.thread_id)))];
      return <><h1>Поддержка</h1><ActionButton url="/api/studio/outbox/retry" label="Повторить неудачные уведомления"/>{threads.map(id=><section className="info-box" key={id}><h2>Обращение {id.slice(0,8)}</h2>{messages.filter(m=>m.thread_id===id).slice().reverse().map(m=><div className="support-message" key={String(m.id)}><strong>{m.sender==='human'?'Сотрудник JUICY':'Ученик'}</strong><p>{String(m.body)}</p></div>)}{hasGrant(user,'support.respond')?<SupportForm threadId={id}/>:null}</section>)}</>;
    }
    if(path[0]==='audit') {check(user.role==='techadmin',403,'TECHADMIN_ONLY');const events=(await db.query('SELECT id,operation,entity_id,created_at FROM audit_events ORDER BY created_at DESC LIMIT 100')).rows;return <><h1>Аудит</h1>{events.map(e=><p key={String(e.id)}>{String(e.created_at)} · {String(e.operation)} · {String(e.entity_id)}</p>)}</>;}
    notFound();
  });
}
