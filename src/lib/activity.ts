import { z } from 'zod';
import { academyDetailKinds } from './catalog';
import { canEditContent, getContent, type Content } from './content';
import type { Db } from './db';
import { check } from './errors';
import { audit, hasGrant, isStudioRole, requireGrant, type Principal } from './security';

const academySections = new Set(['learn','kenwood','ambassadors','profile','more','club','recipes',
  'search','attachments','events','materials','collections','news']);
const studioSections = new Set(['courses','recipes','sections','announcements','events']);
export const canManageMedia = (user: Principal) => hasGrant(user,'media.upload') || hasGrant(user,'media.delete');
export const pageViewInput = z.object({path:z.string().max(150).regex(/^\/(academy|admin)(?:\/[a-z0-9-]+){0,2}$/)}).strict();

export async function recordPageView(db:Db, user:Principal, path:string) {
  const [,area,section,detail]=path.split('/');
  if(area==='academy') {
    if(detail) {
      check(Object.hasOwn(academyDetailKinds,section),404,'ROUTE_NOT_FOUND');
      const item=await getContent(db,detail,user);
      check(item.slug===detail&&item.kind===academyDetailKinds[section],404,'ROUTE_NOT_FOUND');
    } else check(!section||academySections.has(section),404,'ROUTE_NOT_FOUND');
  } else {
    check(isStudioRole(user.role),403,'PERMISSION_DENIED');
    if(detail) {
      check(['edit','preview'].includes(section)&&z.uuid().safeParse(detail).success,404,'ROUTE_NOT_FOUND');
      requireGrant(user,'content.read');
      const node=(await db.query<{kind:string;status:Content['status']}>('SELECT kind,status FROM content WHERE id=$1',[detail])).rows[0];
      check(node,404,'CONTENT_NOT_FOUND');
      if(section==='edit')check(canEditContent(user,node.kind,node.status),403,'PERMISSION_DENIED');
    } else if(section==='users') requireGrant(user,'students.read');
    else if(section==='audit') requireGrant(user,'audit.read');
    else if(section==='support') requireGrant(user,'support.read');
    else if(section==='media') check(canManageMedia(user),403,'PERMISSION_DENIED');
    else if(section==='new') {requireGrant(user,'content.read');requireGrant(user,'content.edit');}
    else if(studioSections.has(section)) requireGrant(user,'content.read');
    else check(!section,404,'ROUTE_NOT_FOUND');
  }
  await audit(db,user.id,'page.view',path);
}

export type AuditFilter = {days:7|30;kind:'all'|'visits'|'actions';q:string;page:number};
export function readAuditFilter(get:(key:string)=>unknown):AuditFilter {
  const page=Number(get('page')??1);
  const kind=get('kind');
  const query=get('q');
  return {
    days:get('days')==='30'?30:7,
    kind:kind==='visits'||kind==='actions'?kind:'all',
    q:typeof query==='string'?query.trim().slice(0,120):'',
    page:Number.isSafeInteger(page)?Math.max(1,Math.min(200,page)):1,
  };
}

export async function auditPage(db:Db, user:Principal, filter:AuditFilter) {
  requireGrant(user,'audit.read');
  // Regular admins see their own events and learner activity. Staff security events stay with Tech Admin.
  const rows=(await db.query<{
    id:string;actor_name:string|null;actor_role:string|null;operation:string;entity_id:string;
    created_at:string|Date;visit_count:number|null;
  }>(`SELECT a.id,u.display_name AS actor_name,a.actor_role,a.operation,a.entity_id,a.created_at,
    CASE WHEN a.operation='page.view' THEN (count(*) OVER(PARTITION BY a.actor_id,a.operation,a.entity_id))::int END AS visit_count
    FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id
    WHERE a.created_at >= now()-($1::int * interval '1 day')
      AND ($2::boolean OR a.actor_id=$3 OR (a.actor_role IN ('student','ambassador') AND u.role IN ('student','ambassador')))
      AND ($4='all' OR ($4='visits' AND a.operation='page.view') OR ($4='actions' AND a.operation<>'page.view'))
      AND ($5='' OR position(lower($5) in lower(concat_ws(' ',u.display_name,a.entity_id,a.operation)))>0)
    ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET $6`,
    [filter.days,user.role==='techadmin',user.id,filter.kind,filter.q,(filter.page-1)*50])).rows;
  return {rows:rows.slice(0,50),hasMore:rows.length>50&&filter.page<200};
}
