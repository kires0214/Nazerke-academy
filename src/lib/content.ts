import { z } from 'zod';
import type { Db } from './db';
import { check } from './errors';
import { audit, canLearn, hasGrant, requireGrant, type Principal, type Grant } from './security';

import { kinds,assetNames } from './catalog';
export { kinds,assetNames } from './catalog';
const lines = z.array(z.string().trim().min(1).max(2000)).max(100).default([]);
export const bodySchema = z.object({
  body: z.string().max(50000).default(''), ingredients: lines, steps: lines,
  settings: z.string().max(4000).default(''), category: z.string().max(120).default(''),
  duration: z.number().int().min(1).max(2880).optional(), portions: z.number().int().min(1).max(100).optional(),
  model: z.string().max(120).default(''), assembly: z.string().max(5000).default(''),
  usage: z.string().max(5000).default(''), care: z.string().max(5000).default(''), mistakes: z.string().max(5000).default(''),
  shoppingList: lines, prepPlan: lines, postKind: z.enum(['article','news','offer','faq']).optional(),
  city: z.string().max(120).optional(), startsAt: z.iso.datetime({offset:true}).optional(), capacity: z.number().int().min(1).max(1000).optional(),
}).strict();
export const contentSchema = z.object({
  kind: z.enum(kinds), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/), title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(''), language: z.enum(['RU','KZ']).default('RU'),
  audience: z.enum(['public','academy','ambassador']).default('academy'), status: z.enum(['draft','published','hidden','archived']).default('draft'),
  parentId: z.uuid().nullable().default(null), sortOrder: z.number().int().min(0).max(100000).default(0),
  cover: z.string().refine(x=>assetNames.some(n=>x===n+'.webp')).nullable().default(null),
  data: bodySchema.default(() => bodySchema.parse({})), links: z.array(z.uuid()).max(100).default([]),
  mediaIds: z.array(z.uuid()).max(20).default([]), version: z.number().int().positive().optional(),
}).strict();
export type ContentInput = z.infer<typeof contentSchema>;
export type Content = {
  id:string;kind:string;slug:string;title:string;description:string;language:string;audience:string;status:string;
  parent_id:string|null;sort_order:number;cover:string|null;data:z.infer<typeof bodySchema>;version:number;published_at:string|null;
};
export function visible(node: Content, all: Content[], user?: Principal): boolean {
  if (node.status !== 'published' || (node.audience !== 'public' && (!user || !canLearn(user,node.audience)))) return false;
  if (!node.parent_id) return true;
  const parent = all.find(x=>x.id===node.parent_id);
  return !!parent && parent.id !== node.id && parent.kind !== node.kind && visible(parent,all,user);
}
export async function listContent(db: Db, user?: Principal, studio = false) {
  if(studio) { check(user,401,'LOGIN_REQUIRED'); requireGrant(user,'content.read'); }
  const { rows } = await db.query<Content & Record<string,unknown>>('SELECT id,kind,slug,title,description,language,audience,status,parent_id,sort_order,cover,data,version,published_at FROM content ORDER BY sort_order,title FOR SHARE');
  return studio ? rows : rows.filter(node=>visible(node,rows,user));
}
export async function getContent(db: Db, idOrSlug: string, user?: Principal) {
  const all = await listContent(db,user);
  const node = all.find(x=>x.id === idOrSlug || x.slug === idOrSlug);
  check(node,404,'CONTENT_NOT_FOUND');
  return node;
}
const kindGrants: Record<string,Grant> = {section:'sections.manage',course:'courses.manage',module:'courses.manage',lesson:'courses.manage',recipe:'recipes.manage',event:'events.manage',post:'announcements.manage'};
export async function saveContent(db: Db, actor: Principal, raw: unknown, id?: string) {
  const input = contentSchema.parse(raw);
  requireGrant(actor,'content.edit');
  if(kindGrants[input.kind]) requireGrant(actor,kindGrants[input.kind]);
  const existing = id ? (await db.query<Content & Record<string,unknown>>('SELECT * FROM content WHERE id=$1 FOR UPDATE',[id])).rows[0] : null;
  if(id) { check(existing,404,'CONTENT_NOT_FOUND'); check(input.version === existing.version,409,'CONTENT_CHANGED_RELOAD'); check(existing.kind === input.kind,400,'KIND_IMMUTABLE'); }
  if (input.status === 'published' || existing?.status === 'published') requireGrant(actor,'content.publish');
  if (input.status === 'archived') requireGrant(actor,'content.delete');
  if (['module','lesson'].includes(input.kind)) {
    check(input.parentId,400,'PARENT_REQUIRED');
    const parent = (await db.query<Content & Record<string,unknown>>('SELECT * FROM content WHERE id=$1 FOR SHARE',[input.parentId])).rows[0];
    check(parent && parent.kind === (input.kind === 'module' ? 'course' : 'module'),400,'INVALID_PARENT');
    check(parent.audience === input.audience,400,'PARENT_AUDIENCE_MISMATCH');
    if(input.status === 'published') check(parent.status === 'published',400,'PUBLISH_PARENT_FIRST');
  } else check(!input.parentId,400,'ROOT_CONTENT_REQUIRED');
  if(input.kind === 'event' && input.status === 'published') check(input.data.city && input.data.startsAt && input.data.capacity,400,'EVENT_DETAILS_REQUIRED');
  if(input.kind === 'recipe' && input.status === 'published') check(input.data.ingredients.length && input.data.steps.length && input.data.duration && input.data.portions,400,'RECIPE_DETAILS_REQUIRED');
  if(input.audience === 'public') check(['post','event','section'].includes(input.kind),400,'PRIVATE_CONTENT_KIND');
  const linked = input.links.length ? (await db.query<Content & Record<string,unknown>>('SELECT * FROM content WHERE id=ANY($1::uuid[]) FOR SHARE',[input.links])).rows : [];
  check(linked.length===new Set(input.links).size && !input.links.includes(id??''),400,'INVALID_LINK');
  for(const target of linked) check(input.kind==='recipe' ? target.kind==='attachment' : ['lesson','collection','course','attachment'].includes(input.kind) && target.kind==='recipe',400,'INVALID_RELATIONSHIP');
  const media = input.mediaIds.length ? (await db.query<{id:string;kind:string;state:string}>('SELECT id,kind,state FROM media WHERE id=ANY($1::uuid[]) FOR SHARE',[input.mediaIds])).rows : [];
  check(media.length===new Set(input.mediaIds).size,400,'MEDIA_NOT_FOUND');
  if(input.status === 'published') check(media.every(x=>x.state==='ready'),400,'MEDIA_NOT_READY');
  if(input.audience === 'public') check(media.every(x=>x.kind!=='video'),400,'PUBLIC_VIDEO_FORBIDDEN');
  const params = [input.kind,input.slug,input.title,input.description,input.language,input.audience,input.status,input.parentId,input.sortOrder,input.cover,JSON.stringify(input.data)];
  const { rows } = existing ? await db.query<{id:string}>(`UPDATE content SET kind=$1,slug=$2,title=$3,description=$4,language=$5,audience=$6,status=$7,parent_id=$8,sort_order=$9,cover=$10,data=$11,version=version+1,updated_at=now(),published_at=CASE WHEN $7='published' THEN coalesce(published_at,now()) ELSE published_at END WHERE id=$12 RETURNING id`,[...params,id]) :
    await db.query<{id:string}>(`INSERT INTO content(kind,slug,title,description,language,audience,status,parent_id,sort_order,cover,data,created_by,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $7='published' THEN now() END) RETURNING id`,[...params,actor.id]);
  const contentId = rows[0].id;
  await db.query('DELETE FROM content_links WHERE source_id=$1',[contentId]);
  for(const [order,target] of input.links.entries()) await db.query('INSERT INTO content_links(source_id,target_id,sort_order) VALUES($1,$2,$3)',[contentId,target,order]);
  await db.query('DELETE FROM content_media WHERE content_id=$1',[contentId]);
  for(const mediaId of new Set(input.mediaIds)) await db.query('INSERT INTO content_media(content_id,media_id) VALUES($1,$2)',[contentId,mediaId]);
  await audit(db,actor.id,'content.'+input.status,contentId,{version:existing ? existing.version+1 : 1});
  if(input.status==='published' && existing?.status!=='published') {
    await db.query(`INSERT INTO notification_outbox(chat_id,body) SELECT u.telegram_id,$1 FROM users u WHERE u.status='approved' AND u.telegram_opt_in
      AND ($2='public' OR u.role='techadmin' OR EXISTS(SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope='academy')
      AND ($2='academy' OR u.role='ambassador' AND EXISTS(SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope='ambassador')))`,['JUICY: '+input.title,input.audience]);
  }
  return contentId;
}

export async function setProgress(db: Db, user: Principal, id: string, position: number, completed: boolean) {
  const node = await getContent(db,id,user); check(node.kind==='lesson',400,'LESSON_REQUIRED');
  const all = await listContent(db,user);
  const module=all.find(n=>n.id===node.parent_id);
  const modules=all.filter(n=>n.kind==='module'&&n.parent_id===module?.parent_id);
  const earlier = all.filter(n=>n.kind==='lesson' && (n.parent_id===node.parent_id && n.sort_order<node.sort_order ||
    modules.some(m=>m.id===n.parent_id&&m.sort_order<(module?.sort_order??0))));
  const done = (await db.query<{lesson_id:string}>('SELECT lesson_id FROM lesson_progress WHERE user_id=$1 AND completed_at IS NOT NULL',[user.id])).rows;
  check(earlier.every(n=>done.some(d=>d.lesson_id===n.id)),409,'COMPLETE_EARLIER_LESSONS');
  await db.query(`INSERT INTO lesson_progress(user_id,lesson_id,position_seconds,completed_at) VALUES($1,$2,$3,CASE WHEN $4 THEN now() END)
    ON CONFLICT(user_id,lesson_id) DO UPDATE SET position_seconds=$3,completed_at=coalesce(lesson_progress.completed_at,CASE WHEN $4 THEN now() END),last_opened_at=now()`,[user.id,id,position,completed]);
}

export function filterContent(all: Content[], params: URLSearchParams) {
  const q=(params.get('q')??'').slice(0,200).toLocaleLowerCase();
  return all.filter(n=>(!params.get('kind')||n.kind===params.get('kind')) && (!params.get('language')||n.language===params.get('language')) &&
    (!params.get('category')||n.data.category===params.get('category')) && (!params.get('duration')||Number(n.data.duration)<=Number(params.get('duration'))) &&
    (!q || `${n.title} ${n.description} ${n.data.model}`.toLocaleLowerCase().includes(q)));
}
