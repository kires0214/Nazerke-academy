import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CmsEditor,MediaUpload } from '@/components/cms-editor';
import { RegistrationControls,StaffControls,StudentTrackControls } from '@/components/staff-controls';
import { ActionButton,SupportForm } from '@/components/actions';
import { ContentCards } from '@/components/cards';
import { ContentPresentation,ContentProgram,EventDetails,type PresentationMedia } from '@/components/content-presentation';
import { kindLabels,mediaDetail,mediaKindLabels,mediaStatusLabels,publicationLabels,statusLabels,type PublicationType,type StudioKind } from '@/components/studio-labels';
import { groupLabel } from '@/components/catalog-tabs';
import { withDb } from '@/lib/db';
import { pageTokens,studioData } from '@/lib/pages';
import { hasGrant,isStudioRole,principal } from '@/lib/security';
import { canDeleteContent,canEditContent,kinds,listContent } from '@/lib/content';
import { supportHistory } from '@/lib/support';
import { check } from '@/lib/errors';
import { academyPostSections,catalogGroups,contentTracks,groupFor,learningTracks,orderSourceLabels,sectionFor,trackLabels } from '@/lib/catalog';
import { pendingRegistrationRequests } from '@/lib/telegram-access';
import { auditPage,canManageMedia,readAuditFilter } from '@/lib/activity';
import { studioAccounts } from '@/lib/accounts';
import { StudioList } from '@/components/studio-list';
import { AuditPanel } from '@/components/audit-panel';
const contentSections=[
  {slug:'',label:'Все материалы',kinds:[]},
  {slug:'courses',label:'Курсы и уроки',kinds:['course','module','lesson']},
  {slug:'recipes',label:'Рецепты и подборки',kinds:['recipe','attachment','collection']},
  {slug:'sections',label:'Разделы и файлы',kinds:['section','material']},
  {slug:'announcements',label:'Статьи и анонсы',kinds:['post']},
  {slug:'offers',label:'Акции',kinds:['post']},
  {slug:'coming-soon',label:'Coming Soon',kinds:['post']},
  {slug:'events',label:'Мастер-классы',kinds:['event']},
];
const accountRoles:Record<string,string>={student:'Ученик',admin:'Администратор',techadmin:'Tech Admin'};
const accountStatuses:Record<string,string>={approved:'Допущен',pending:'Ожидает решения',blocked:'Заблокирован',archived:'В архиве'};
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
      const language=query.language==='RU'||query.language==='EN'?query.language:'';
      const track=learningTracks.find(value=>value===query.track);
      const placement=learningTracks.find(value=>value===query.section);
      const group=catalogGroups.find(value=>value===query.group);
      const sectionUrl=contentSection.slug?'/admin/'+contentSection.slug:'/admin';
      const postKind=academyPostSections[contentSection.slug];
      const byId=new Map(nodes.map(node=>[node.id,node]));
      const displayed=nodes.filter(node=>{
        const parent=byId.get(node.parent_id??'');
        const root=byId.get(parent?.parent_id??'')??parent??node;
        return (
        (!contentSection.kinds.length||contentSection.kinds.includes(node.kind))&&(!status||node.status===status)&&(!language||node.language===language)&&
        (postKind?node.data.postKind===postKind:contentSection.slug!=='announcements'||!Object.values(academyPostSections).some(kind=>kind===node.data.postKind))&&
        (!placement||sectionFor(root.audience,root.data)===placement)&&(!group||groupFor(root.kind,root.data)===group)&&
        (!track||root.audience!=='public'&&contentTracks(root.audience,root.data).some(value=>value===track))&&
        (!term||`${node.title} ${node.slug}`.toLocaleLowerCase('ru').includes(term.toLocaleLowerCase('ru'))));
      });
      const filtered=term||status||language||track||placement||group;
      return <>
        <div className="section-heading studio-heading"><h1>{contentSection.slug?contentSection.label:'Контент'}</h1>
          {contentSection.slug==='events'&&canEditContent(user,'event')?<Link className="btn btn-dark" href="/admin/new?kind=event">Создать мастер-класс</Link>:
            contentSection.slug==='offers'&&canEditContent(user,'post')?<Link className="btn btn-dark" href="/admin/new?kind=post&publication=offer">Создать акцию</Link>:
            contentSection.slug==='coming-soon'&&canEditContent(user,'post')?<Link className="btn btn-dark" href="/admin/new?kind=post&publication=coming-soon">Создать анонс</Link>:
            kinds.some(kind=>canEditContent(user,kind))?<Link className="btn btn-dark" href="/admin/new">Создать материал</Link>:null}</div>
        <nav className="studio-content-nav" aria-label="Виды материалов">
          {contentSections.map(section=><Link key={section.slug} href={section.slug?'/admin/'+section.slug:'/admin'} aria-current={section===contentSection?'page':undefined}>{section.label}</Link>)}
        </nav>
        <form className="filters studio-filters" method="GET" action={sectionUrl} key={sectionUrl+term+status+language+track+placement+group}>
          <label>Название или адрес<input name="q" type="search" defaultValue={term} maxLength={120}/></label>
          <label>Статус<select name="status" defaultValue={status}><option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Язык<select name="language" defaultValue={language}><option value="">Все языки</option>
            <option value="RU">Русский</option><option value="EN">English</option></select></label>
          <label>Допуск<select name="track" defaultValue={track??''}><option value="">Все допуски</option>
            {learningTracks.map(value=><option key={value} value={value}>{trackLabels[value]}</option>)}</select></label>
          <label>Раздел<select name="section" defaultValue={placement??''}><option value="">Все разделы</option>
            {learningTracks.map(value=><option key={value} value={value}>{trackLabels[value]}</option>)}</select></label>
          <label>Подгруппа<select name="group" defaultValue={group??''}><option value="">Все подгруппы</option>
            {catalogGroups.map(value=><option key={value} value={value}>{groupLabel('ru',value)}</option>)}</select></label>
          <button className="btn btn-dark" type="submit">Найти</button>
          {filtered?<Link className="btn btn-outline" href={sectionUrl}>Сбросить</Link>:null}
        </form>
        {displayed.length?<div className="course-steps">{displayed.map(node=>{
          const editable=canEditContent(user,node.kind,node.status);
          return <Link className="step" key={node.id} href={`/admin/${editable?'edit':'preview'}/${node.id}`}>
            <div className="step-body"><strong>{node.title}</strong><small>{node.kind==='post'?publicationLabels[node.data.postKind??'article']:kindLabels[node.kind as StudioKind]} · {node.language==='KZ'?'Архивный язык':node.language} · {statusLabels[node.status]}</small></div>
            <span className="small-link">{editable?'Редактировать':'Открыть'}</span>
          </Link>;
        })}</div>:<p className="empty">{filtered?'По этому запросу материалы не найдены.':'В этом разделе пока нет материалов.'}</p>}
      </>;
    }
    if(['new','edit','preview'].includes(path[0])) {
      if(!hasGrant(user,'content.read')||path[0]!=='preview'&&!hasGrant(user,'content.edit'))notFound();
      const nodes=await listContent(db,user,true),node=nodes.find(n=>n.id===path[1]);if(path[0]!=='new'&&!node)notFound();
      const allowedKinds=kinds.filter(kind=>canEditContent(user,kind));
      if(path[0]==='new'&&!allowedKinds.length)notFound();
      const initial=path[0]==='new'?await searchParams:{};
      const publication=Object.keys(publicationLabels).find(type=>type===initial.publication) as PublicationType|undefined;
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
      const media=(await db.query<{id:string;kind:string;state:string;created_at:Date;file_name:string|null}>(`SELECT id,kind,state,created_at,file_name
        FROM media WHERE id IN (SELECT id FROM media ORDER BY created_at DESC LIMIT 200) OR id=ANY($1::uuid[])
        ORDER BY created_at DESC`,[mediaIds])).rows.map(file=>({...file,name:file.file_name??undefined,created_at:file.created_at.toISOString()}));
      const choices=nodes.map(({id,title,slug,kind,status,parent_id,audience,data})=>({id,title,slug,kind,status,parent_id,audience,
        data:{catalogSection:data.catalogSection,catalogGroup:data.catalogGroup,equipmentBrand:data.equipmentBrand,tracks:data.tracks}}));
      return <><p><Link className="small-link" href="/admin">← Все материалы</Link></p><h1>{node?node.title:'Новый материал'}</h1>
        {node?<p><Link className="btn btn-outline" href={previewHref(node)}>Предпросмотр сохранённой версии</Link></p>:null}
        <CmsEditor key={node?.id??'new'} node={node} nodes={choices} media={media} links={links} mediaIds={mediaIds}
          allowedKinds={allowedKinds} initialKind={allowedKinds.find(kind=>kind===initial.kind)} initialPostKind={publication}
          canPublish={hasGrant(user,'content.publish')} canArchive={hasGrant(user,'content.delete')}
          canUpload={hasGrant(user,'media.upload')}/>
        {deleteAction?<div className="detail-actions">{deleteAction}</div>:null}
      </>;
    }
    if(path[0]==='users') {
      if(!hasGrant(user,'students.read'))notFound();
      const requests=await pendingRegistrationRequests(db,user);
      const view=(await searchParams).view;
      const archive=view==='archive';
      const showRequests=view==='requests'||!archive&&view!=='accounts'&&!!requests.length;
      const canApprove=hasGrant(user,'students.approve'),canEditTracks=hasGrant(user,'students.tracks');
      const canEditSchool=hasGrant(user,'ambassadors.assign'),tech=user.role==='techadmin';
      const canBlock=hasGrant(user,'students.block');
      const users=showRequests?[]:await studioAccounts(db,user,archive);
      const allGrants=tech&&!showRequests&&!archive?(await db.query<{user_id:string;permission:string}>('SELECT user_id,permission FROM admin_grants')).rows:[];
      return <><h1>Доступ в академию</h1>
        <nav className="studio-content-nav" aria-label="Управление доступом">
          <Link href="/admin/users?view=accounts" aria-current={!showRequests&&!archive?'page':undefined}>Аккаунты</Link>
          <Link href="/admin/users?view=requests" aria-current={showRequests?'page':undefined}>Заявки{requests.length?' ('+requests.length+')':''}</Link>
          <Link href="/admin/users?view=archive" aria-current={archive?'page':undefined}>Архив</Link>
        </nav>
        {showRequests?<StudioList key="requests" searchLabel="Имя, телефон или заказ" empty="Новых заявок нет." filters={[
          {key:'source',label:'Магазин',options:Object.entries(orderSourceLabels)},
        ]} rows={requests.map(request=>({
          id:request.id,terms:[request.display_name,request.phone,request.order_number].filter(Boolean).join(' '),
          values:{source:request.order_source?[request.order_source]:[]},
          content:<section className="studio-record">
            <h2>{request.display_name}</h2><p>{request.phone}</p>
            {request.order_source&&request.order_number?
              <p>{orderSourceLabels[request.order_source]} · заказ <strong>{request.order_number}</strong></p>:
              <p className="studio-hint">Заявка отправлена до добавления номера заказа.</p>}
            {canApprove?<details className="studio-disclosure"><summary>Рассмотреть заявку</summary>
              <div><RegistrationControls id={request.id} canAssignTracks={canEditTracks} canAssignAdmin={tech}/>
                <ActionButton url={'/api/studio/registration/'+request.id} payload={{action:'decline'}} label="Отклонить" variant="outline" confirm="Отклонить заявку на приглашение?"/>
              </div>
            </details>:null}
          </section>,
        }))}/>:<StudioList key={archive?'archive':'accounts'} searchLabel="Имя пользователя" empty={archive?'Архив пуст.':'Аккаунтов пока нет.'} filters={[
          ...(!archive?[{key:'status',label:'Статус',options:Object.entries(accountStatuses).filter(([status])=>status!=='archived')}]:[]),
          {key:'role',label:'Роль',options:tech?Object.entries(accountRoles):[['student','Ученик']]},
          {key:'track',label:'Учебный допуск',options:[...Object.entries(trackLabels),['none','Без допусков']]},
          {key:'session',label:'Сеанс',options:[['active','Активный'],['inactive','Нет активного']]},
        ]} rows={users.map(u=>{
          const current=learningTracks.filter(track=>u.tracks.includes(track));
          const manageable=u.role!=='techadmin'&&(tech||u.role==='student'&&(canApprove||canBlock||
            hasGrant(user,'devices.reset')||canEditTracks||canEditSchool));
          const accountUrl='/api/studio/accounts/'+u.id;
          const deleteAccount=tech&&u.role!=='techadmin'?<ActionButton url={accountUrl} payload={{action:'delete'}} label="Удалить аккаунт" variant="outline"
            confirm="Удалить аккаунт без восстановления? Прогресс, избранное, записи и данные заявки будут удалены. Для повторного входа потребуется новое приглашение."/>:null;
          return {id:u.id,terms:u.display_name,values:{status:[u.status],role:[u.role],track:current.length?current:['none'],
            session:[u.active_session?'active':'inactive']},content:<section className="studio-record">
            <div className="studio-record-heading"><h2>{u.display_name}</h2><span className="studio-status">{accountStatuses[u.status]}</span></div>
            <p>{accountRoles[u.role]} · {u.active_session?'Активный сеанс':'Нет активного сеанса'}</p>
            {u.role==='student'?<p>{current.length?current.map(track=>trackLabels[track]).join(' · '):'Без учебных допусков'}</p>:null}
            {u.last_login?<p className="studio-hint">Последний вход · {new Date(u.last_login).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda'})}</p>:null}
            {archive?<div className="detail-actions">
              {canBlock&&manageable?<ActionButton url={accountUrl} payload={{action:'restore'}} label="Восстановить из архива"/>:null}
              {deleteAccount}
            </div>:manageable?<details className="studio-disclosure"><summary>Управление аккаунтом</summary><div>
              <div className="detail-actions">
              {u.status==='pending'&&canApprove?<ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'approve'}} label="Подтвердить доступ"/>:null}
              {canBlock?<ActionButton url={accountUrl} payload={{action:u.status==='blocked'?'unblock':'block'}}
                label={u.status==='blocked'?'Разблокировать':'Заблокировать'} variant="outline"
                confirm={u.status==='blocked'?undefined:'Заблокировать аккаунт и завершить его сеанс?'}/>:null}
              {canBlock?<ActionButton url={accountUrl} payload={{action:'archive'}} label="В архив" variant="outline"
                confirm="Перенести аккаунт в архив и завершить его сеанс? Позже доступ можно восстановить."/>:null}
              {deleteAccount}
              {hasGrant(user,'devices.reset')?<ActionButton url={'/api/studio/devices/'+u.id} label="Сбросить браузер" variant="outline" confirm="Сбросить привязку браузера пользователя?"/>:null}
              {tech&&u.role==='admin'?<>
                <ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:true}} label="Дать учебный допуск" variant="outline"/>
                <ActionButton url={'/api/studio/accounts/'+u.id} payload={{action:'learning',enabled:false}} label="Снять учебный допуск" variant="outline"/>
              </>:null}</div>
              {u.role==='student'&&u.status==='approved'&&(canEditTracks||canEditSchool)?
                <StudentTrackControls id={u.id} current={current} onlyAmbassador={!canEditTracks}/>:null}
              {tech?<StaffControls id={u.id} role={u.role} currentGrants={allGrants.filter(g=>g.user_id===u.id).map(g=>g.permission)}/>:null}
            </div></details>:null}
          </section>};
        })}/>}
      </>;
    }
    if(path[0]==='media') {
      if(!canManageMedia(user))notFound();
      const media=(await db.query<{id:string;kind:string;state:string;provider:string;created_at:Date;file_name:string|null}>(`
        SELECT id,kind,state,provider,created_at,file_name FROM media ORDER BY created_at DESC LIMIT 200`)).rows;
      const canUpload=hasGrant(user,'media.upload'),canDelete=hasGrant(user,'media.delete');
      return <><h1>Медиафайлы</h1>
        {canUpload?<details className="studio-disclosure studio-upload-panel" open={!media.length}><summary>Загрузить видео или файл</summary><div><MediaUpload/></div></details>:null}
        <StudioList searchLabel="Имя файла или ID" empty="Медиафайлов пока нет." filters={[
          {key:'kind',label:'Тип файла',options:Object.entries(mediaKindLabels)},
          {key:'state',label:'Готовность',options:Object.entries(mediaStatusLabels)},
        ]} rows={media.map(file=>({
          id:file.id,terms:[file.file_name,file.id,mediaKindLabels[file.kind]].filter(Boolean).join(' '),values:{kind:[file.kind],state:[file.state]},
          content:<div className="studio-record">
            <div className="studio-record-heading"><h2>{file.file_name??mediaKindLabels[file.kind]??'Файл'}</h2>
              <span className="studio-status">{mediaStatusLabels[file.state]}</span></div>
            <p>{mediaDetail({...file,created_at:file.created_at.toISOString()})}</p>
            <div className="detail-actions">{file.provider==='mux'&&canUpload?<ActionButton url={'/api/studio/media/'+file.id+'/refresh'} label="Обновить статус" variant="outline"/>:null}
              {canDelete&&file.provider!=='stream'?<ActionButton url={'/api/studio/media/'+file.id} method="DELETE" label="Удалить файл" variant="outline" confirm="Удалить этот файл навсегда?"/>:null}</div>
          </div>,
        }))}/>
      </>;
    }
    if(path[0]==='support') {
      if(!hasGrant(user,'support.read'))notFound();
      const messages=await supportHistory(db,user,true),threads=[...new Set(messages.map(message=>String(message.thread_id)))];
      const canReply=hasGrant(user,'support.respond');
      return <><div className="section-heading studio-heading"><h1>Поддержка</h1>
        {canReply?<ActionButton url="/api/studio/outbox/retry" label="Повторить неудачные уведомления" variant="outline"/>:null}
      </div>
      <StudioList searchLabel="Номер или текст обращения" empty="Обращений пока нет." filters={[
        {key:'reply',label:'Ответ',options:[['waiting','Ждёт ответа'],['answered','Отвечено']]},
      ]} rows={threads.map(id=>{
        const thread=messages.filter(message=>message.thread_id===id),latest=thread[0];
        const answered=latest.sender==='human';
        return {id,terms:[id,...thread.map(message=>String(message.body))].join(' '),values:{reply:[answered?'answered':'waiting']},
          content:<details className="studio-record studio-thread"><summary><strong>Обращение {id.slice(0,8)}</strong>
              <span className="studio-status">{answered?'Отвечено':'Ждёт ответа'}</span>
              <span className="studio-thread-preview">{String(latest.body).slice(0,120)}</span>
            </summary>
            <div>{thread.slice().reverse().map(message=><div className="support-message" key={String(message.id)}>
              <strong>{message.sender==='human'?'Сотрудник JUICY':'Ученик'}</strong><p>{String(message.body)}</p>
            </div>)}{canReply?<SupportForm threadId={id}/>:null}</div>
          </details>};
      })}/>
      </>;
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
