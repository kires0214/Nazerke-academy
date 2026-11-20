import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CmsEditor,MediaUpload } from '@/components/cms-editor';
import { RegistrationControls,StaffControls } from '@/components/staff-controls';
import { ActionButton,SupportForm } from '@/components/actions';
import { ContentCards } from '@/components/cards';
import { ContentPresentation,ContentProgram,EventDetails,type PresentationMedia } from '@/components/content-presentation';
import { kindLabels,mediaDetail,mediaKindLabels,statusLabels,type StudioKind } from '@/components/studio-labels';
import { withDb } from '@/lib/db';
import { pageTokens,studioData } from '@/lib/pages';
import { hasGrant,isStudioRole,principal } from '@/lib/security';
import { canDeleteContent,canEditContent,kinds,listContent } from '@/lib/content';
import { supportHistory } from '@/lib/support';
import { check } from '@/lib/errors';
import { pendingRegistrationRequests } from '@/lib/telegram-access';
import { auditPage,canManageMedia,readAuditFilter } from '@/lib/activity';
import { studioAccounts } from '@/lib/accounts';
import { AuditPanel } from '@/components/audit-panel';
const contentSections=[
  {slug:'',label:'Все материалы',kinds:[]},
  {slug:'courses',label:'Курсы и уроки',kinds:['course','module','lesson']},
  {slug:'recipes',label:'Рецепты и подборки',kinds:['recipe','attachment','collection']},
  {slug:'sections',label:'Разделы и файлы',kinds:['section','material']},
  {slug:'announcements',label:'Статьи и анонсы',kinds:['post']},
  {slug:'events',label:'Мастер-классы',kinds:['event']},
];
const accountRoles:Record<string,string>={student:'Ученик',ambassador:'Амбассадор',admin:'Администратор',techadmin:'Tech Admin'};
const accountStatuses:Record<string,string>={approved:'Допущен',pending:'Ожидает решения',blocked:'Заблокирован'};
const previewHref=(node:{id:string})=>'/admin/preview/'+node.id;
export default async function Page({params,searchParams}:{params:Promise<{path?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await studioData();
  const path=(await params).path??[],tokens=await pageTokens();
  return withDb(async db=>{
    const user=await principal(db,tokens);check(isStudioRole(user.role),403,'STAFF_REQUIRED');
    const contentSection=path.length<=1?contentSections.find(section=>section.slug===(path[0]??'')):undefined;
    if(contentSection) {
      if(!hasGrant(user,'content.read')) return <><h1>JUICY Studio</h1><p>Откройте доступный раздел в меню.</p></>;
      const nodes=await listContent(db,user,true);
      const query=await searchParams;
      const term=typeof query.q==='string'?query.q.trim().slice(0,120):'';
      const status=typeof query.status==='string'&&Object.hasOwn(statusLabels,query.status)?query.status:'';
      const sectionUrl=contentSection.slug?'/admin/'+contentSection.slug:'/admin';
      const displayed=nodes.filter(node=>
        (!contentSection.kinds.length||contentSection.kinds.includes(node.kind))&&(!status||node.status===status)&&
        (!term||`${node.title} ${node.slug}`.toLocaleLowerCase('ru').includes(term.toLocaleLowerCase('ru'))));
      return <>
        <div className="section-heading studio-heading"><h1>{contentSection.slug?contentSection.label:'Контент'}</h1>
          {kinds.some(kind=>canEditContent(user,kind))?<Link className="btn btn-dark" href="/admin/new">Создать материал</Link>:null}</div>
        <nav className="studio-content-nav" aria-label="Виды материалов">
          {contentSections.map(section=><Link key={section.slug} href={section.slug?'/admin/'+section.slug:'/admin'} aria-current={section===contentSection?'page':undefined}>{section.label}</Link>)}
        </nav>
        <form className="filters studio-filters" method="GET" action={sectionUrl} key={sectionUrl+term+status}>
          <label>Название или адрес<input name="q" type="search" defaultValue={term} maxLength={120}/></label>
          <label>Статус<select name="status" defaultValue={status}><option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <button className="btn btn-dark" type="submit">Найти</button>
          {term||status?<Link className="btn btn-outline" href={sectionUrl}>Сбросить</Link>:null}
        </form>
        {displayed.length?<div className="course-steps">{displayed.map(node=>{
          const editable=canEditContent(user,node.kind,node.status);
          return <Link className="step" key={node.id} href={`/admin/${editable?'edit':'preview'}/${node.id}`}>
            <div className="step-body"><strong>{node.title}</strong><small>{kindLabels[node.kind as StudioKind]} · {node.language} · {statusLabels[node.status]}</small></div>
            <span className="small-link">{editable?'Редактировать':'Открыть'}</span>
          </Link>;
        })}</div>:<p className="empty">{term||status?'По этому запросу материалы не найдены.':'В этом разделе пока нет материалов.'}</p>}
      </>;
    }
    if(['new','edit','preview'].includes(path[0])) {
      if(!hasGrant(user,'content.read')||path[0]!=='preview'&&!hasGrant(user,'content.edit'))notFound();
      const nodes=await listContent(db,user,true),node=nodes.find(n=>n.id===path[1]);if(path[0]!=='new'&&!node)notFound();
      const allowedKinds=kinds.filter(kind=>canEditContent(user,kind));
      if(path[0]==='new'&&!allowedKinds.length)notFound();
      const editable=node?canEditContent(user,node.kind,node.status):hasGrant(user,'content.edit');
      const deleteAction=node&&node.status!=='published'&&canDeleteContent(user,node.kind)?<ActionButton url={'/api/studio/content/'+node.id} method="DELETE" label="Удалить материал" confirm="Удалить материал навсегда?" goTo="/admin"/>:null;
      if(path[0]==='preview'&&node){
        const media=(await db.query<PresentationMedia>('SELECT m.id,m.kind,m.state FROM media m JOIN content_media l ON l.media_id=m.id WHERE l.content_id=$1 ORDER BY m.created_at',[node.id])).rows;
        const links=(await db.query<{id:string}>(`SELECT target_id AS id FROM content_links WHERE source_id=$1
          UNION SELECT source_id FROM content_links WHERE target_id=$1`,[node.id])).rows;
        const related=nodes.filter(item=>links.some(link=>link.id===item.id));
        return <>
          <div className="studio-preview-toolbar">
            <p>Предпросмотр сохранённой версии · {statusLabels[node.status]}</p>
            <Link className="btn btn-outline" href={editable?'/admin/edit/'+node.id:'/admin'}>{editable?'Вернуться к редактированию':'Все материалы'}</Link>
          </div>
          <article>
            <ContentPresentation node={node} media={media} apiBase={'/api/studio/content/'+node.id+'/media'}/>
            {node.kind==='event'?<EventDetails node={node}/>:null}
            <ContentProgram node={node} nodes={nodes} linkFor={previewHref}/>
            {related.length?<section className="section"><h2>Связанные материалы</h2><ContentCards nodes={related} linkFor={previewHref}/></section>:null}
          </article>
          {deleteAction?<div className="detail-actions">{deleteAction}</div>:null}
        </>;
      }
      if(!editable)return <><h1>Редактирование недоступно</h1><p>Для этого материала нужны дополнительные права.</p><Link href={'/admin/preview/'+node!.id}>Открыть предпросмотр</Link></>;
      const links=node?(await db.query<{target_id:string}>('SELECT target_id FROM content_links WHERE source_id=$1 ORDER BY sort_order',[node.id])).rows.map(l=>l.target_id):[];
      const mediaIds=node?(await db.query<{media_id:string}>('SELECT media_id FROM content_media WHERE content_id=$1',[node.id])).rows.map(l=>l.media_id):[];
      const media=(await db.query<{id:string;kind:string;state:string;created_at:Date}>(`SELECT id,kind,state,created_at
        FROM media WHERE id IN (SELECT id FROM media ORDER BY created_at DESC LIMIT 200) OR id=ANY($1::uuid[])
        ORDER BY created_at DESC`,[mediaIds])).rows.map(file=>({...file,created_at:file.created_at.toISOString()}));
      const choices=nodes.map(({id,title,slug,kind,status,parent_id,audience})=>({id,title,slug,kind,status,parent_id,audience}));
      return <><p><Link className="small-link" href="/admin">← Все материалы</Link></p><h1>{node?node.title:'Новый материал'}</h1>
        {node?<p><Link className="btn btn-outline" href={previewHref(node)}>Предпросмотр сохранённой версии</Link></p>:null}
        <CmsEditor key={node?.id??'new'} node={node} nodes={choices} media={media} links={links} mediaIds={mediaIds}
          allowedKinds={allowedKinds} canPublish={hasGrant(user,'content.publish')} canArchive={hasGrant(user,'content.delete')}
          canUpload={hasGrant(user,'media.upload')}/>
        {deleteAction?<div className="detail-actions">{deleteAction}</div>:null}
      </>;
    }
    if(path[0]==='users') {
      if(!hasGrant(user,'students.read'))notFound();
      const requests=await pendingRegistrationRequests(db,user);
      const users=await studioAccounts(db,user);
      const allGrants=user.role==='techadmin'?(await db.query<{user_id:string;permission:string}>('SELECT user_id,permission FROM admin_grants')).rows:[];
      return <><h1>Доступ в академию</h1><h2>Заявки на приглашение</h2>
        {requests.length===0?<p>Новых заявок нет.</p>:requests.map(request=><section className="info-box" key={request.id}>
          <h3>{request.display_name}</h3><p>{request.phone}</p>
          {hasGrant(user,'students.approve')?<>
            <RegistrationControls id={request.id} canAssignAmbassador={hasGrant(user,'ambassadors.assign')} canAssignAdmin={user.role==='techadmin'}/>
            <ActionButton url={'/api/studio/registration/'+request.id} payload={{action:'decline'}} label="Отклонить" variant="outline"
              confirm="Отклонить заявку на приглашение?"/>
          </>:null}
        </section>)}
        <h2>Аккаунты</h2>{users.map(u=><section className="info-box" key={u.id}><h3>{u.display_name}</h3><p>{accountStatuses[u.status]} · {accountRoles[u.role]} · {u.active_session?'Есть активный сеанс':'Нет активного сеанса'}</p>
        {u.last_login?<p>Последний вход · {new Date(u.last_login).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda'})}</p>:null}<div className="detail-actions">
        {u.status==='pending'&&hasGrant(user,'students.approve')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'approve'}} label="Подтвердить доступ"/>:null}
        {u.role!=='techadmin'&&hasGrant(user,'students.block')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:u.status==='blocked'?'unblock':'block'}} label={u.status==='blocked'?'Разблокировать':'Заблокировать'}/>:null}
        {u.role!=='techadmin'&&hasGrant(user,'devices.reset')?<ActionButton url={'/api/studio/devices/'+u.id} label="Сбросить браузер"/>:null}
        {['student','ambassador'].includes(u.role)&&hasGrant(user,'ambassadors.assign')?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'ambassador',enabled:u.role!=='ambassador'}} label={u.role==='ambassador'?'Снять допуск амбассадора':'Назначить амбассадором'}/>:null}
        {user.role==='techadmin'&&u.role!=='techadmin'?<><ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:true}} label="Дать учебный допуск"/><ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:false}} label="Снять учебный допуск"/></>:null}</div>
        {user.role==='techadmin'&&u.role!=='techadmin'?<StaffControls id={u.id} role={u.role} approved={u.status==='approved'}
          currentGrants={allGrants.filter(g=>g.user_id===u.id).map(g=>g.permission)}/>:null}</section>)}</>;
    }
    if(path[0]==='media') {
      if(!canManageMedia(user))notFound();
      const media=(await db.query<{id:string;kind:string;state:string;provider:string;created_at:Date}>('SELECT id,kind,state,provider,created_at FROM media ORDER BY created_at DESC LIMIT 200')).rows;
      const canUpload=hasGrant(user,'media.upload'),canDelete=hasGrant(user,'media.delete');
      return <><h1>Медиафайлы</h1>{canUpload?<div className="studio-form-section"><h2>Загрузить видео или файл</h2><MediaUpload/></div>:null}
        {media.map(m=><div className="info-box" key={m.id}><strong>{mediaKindLabels[m.kind]??'Файл'}</strong>
          <p>{mediaDetail({...m,created_at:m.created_at.toISOString()})}</p>
          <div className="detail-actions">{m.provider==='mux'&&canUpload?<ActionButton url={'/api/studio/media/'+m.id+'/refresh'} label="Обновить статус"/>:null}
            {canDelete&&m.provider!=='stream'?<ActionButton url={'/api/studio/media/'+m.id} method="DELETE" label="Удалить файл" confirm="Удалить этот файл навсегда?"/>:null}</div></div>)}
      </>;
    }
    if(path[0]==='support') {
      if(!hasGrant(user,'support.read'))notFound();
      const messages=await supportHistory(db,user,true),threads=[...new Set(messages.map(m=>String(m.thread_id)))];
      return <><h1>Поддержка</h1>{hasGrant(user,'support.respond')?<ActionButton url="/api/studio/outbox/retry" label="Повторить неудачные уведомления"/>:null}{threads.map(id=><section className="info-box" key={id}><h2>Обращение {id.slice(0,8)}</h2>{messages.filter(m=>m.thread_id===id).slice().reverse().map(m=><div className="support-message" key={String(m.id)}><strong>{m.sender==='human'?'Сотрудник JUICY':'Ученик'}</strong><p>{String(m.body)}</p></div>)}{hasGrant(user,'support.respond')?<SupportForm threadId={id}/>:null}</section>)}</>;
    }
    if(path[0]==='audit') {
      if(!hasGrant(user,'audit.read'))notFound();
      const query=await searchParams;
      const filter=readAuditFilter(key=>query[key]);
      return <AuditPanel result={await auditPage(db,user,filter)} filter={filter} full={user.role==='techadmin'}/>;
    }
    notFound();
  });
}
