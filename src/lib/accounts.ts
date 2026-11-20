import { z } from 'zod';
import type { Db } from './db';
import { check } from './errors';
import { audit, grants, requireGrant, type Principal } from './security';
import { learningTracks } from './catalog';

export const studentTracksSchema=z.array(z.enum(learningTracks)).max(learningTracks.length).refine(items=>new Set(items).size===items.length);

export const accountSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('approve')}).strict(), z.object({action:z.literal('block')}).strict(), z.object({action:z.literal('unblock')}).strict(),
  z.object({action:z.literal('ambassador'),enabled:z.boolean()}).strict(),
  z.object({action:z.literal('tracks'),tracks:studentTracksSchema}).strict(),
  z.object({action:z.literal('staff'),role:z.enum(['student','admin']),grants:z.array(z.enum(grants)).max(grants.length)}).strict(),
  z.object({action:z.literal('learning'),enabled:z.boolean()}).strict(),
]);
export async function updateAccount(db:Db,actor:Principal,userId:string,raw:unknown) {
  const input=accountSchema.parse(raw);
  if(input.action==='approve') requireGrant(actor,'students.approve');
  if(input.action==='block'||input.action==='unblock') requireGrant(actor,'students.block');
  if(input.action==='ambassador') requireGrant(actor,'ambassadors.assign');
  if(input.action==='tracks') requireGrant(actor,'students.tracks');
  if(['staff','learning'].includes(input.action)) check(actor.role==='techadmin',403,'TECHADMIN_ONLY');
  const target=(await db.query<{id:string;role:string;status:string;telegram_id:string;telegram_opt_in:boolean}>('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
  check(target,404,'USER_NOT_FOUND');
  check(target.role!=='techadmin',403,'TECHADMIN_PROTECTED');
  check(actor.role==='techadmin'||target.role!=='admin',403,'STAFF_TECHADMIN_ONLY');
  if(input.action==='approve') {
    check(target.status==='pending',409,'USER_NOT_PENDING');
    await db.query("UPDATE users SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",[userId,actor.id]);
    if(target.role==='student')await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'academy',$2),($1,'kenwood',$2) ON CONFLICT DO NOTHING",[userId,actor.id]);
    if(target.telegram_opt_in) await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)',[target.telegram_id,'Доступ к JUICY Academy подтверждён.']);
  }
  if(input.action==='block') {
    await db.query("UPDATE users SET status='blocked' WHERE id=$1",[userId]);
  }
  if(input.action==='unblock') {
    check(target.status==='blocked',409,'USER_NOT_BLOCKED');
    await db.query("UPDATE users SET status=CASE WHEN approved_at IS NULL THEN 'pending' ELSE 'approved' END WHERE id=$1",[userId]);
  }
  if(input.action==='staff') {
    check(input.role==='admin'||input.grants.length===0,400,'GRANTS_REQUIRE_ADMIN');
    await db.query('UPDATE users SET role=$2 WHERE id=$1',[userId,input.role]);
    await db.query('DELETE FROM admin_grants WHERE user_id=$1',[userId]);
    await db.query('DELETE FROM access_entitlements WHERE user_id=$1',[userId]);
    if(input.role==='admin') for(const grant of new Set(input.grants)) await db.query('INSERT INTO admin_grants(user_id,permission,granted_by) VALUES($1,$2,$3)',[userId,grant,actor.id]);
    if(input.role==='student'&&target.status==='approved')await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES ($1,'academy',$2)",[userId,actor.id]);
  }
  if(input.action==='ambassador') {
    check(target.role==='student'&&target.status==='approved',409,'APPROVED_LEARNER_REQUIRED');
    await db.query("DELETE FROM access_entitlements WHERE user_id=$1 AND scope='ambassador'",[userId]);
    if(input.enabled) await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'ambassador',$2)",[userId,actor.id]);
  }
  if(input.action==='tracks'){
    check(target.role==='student'&&target.status==='approved',409,'APPROVED_LEARNER_REQUIRED');
    await db.query("DELETE FROM access_entitlements WHERE user_id=$1 AND scope=ANY($2::text[])",[userId,learningTracks]);
    await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) SELECT $1,scope,$2 FROM unnest($3::text[]) AS scope ON CONFLICT DO NOTHING",
      [userId,actor.id,['academy',...input.tracks]]);
  }
  if(input.action==='learning') {
    await db.query("DELETE FROM access_entitlements WHERE user_id=$1 AND scope='academy'",[userId]);
    if(input.enabled) await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'academy',$2),($1,'kenwood',$2) ON CONFLICT DO NOTHING",[userId,actor.id]);
  }
  if(input.action!=='approve') await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await audit(db,actor.id,'account.'+input.action,userId,input.action==='staff'?{role:input.role,grants:input.grants}:
    input.action==='tracks'?{tracks:input.tracks}:{});
}

export async function studioAccounts(db:Db,actor:Principal) {
  requireGrant(actor,'students.read');
  return (await db.query<{id:string;display_name:string;status:string;role:string;active_session:boolean;last_login:Date|null;tracks:string[]}>(`
    SELECT u.id,u.display_name,u.status,u.role,u.created_at,
    EXISTS(SELECT 1 FROM sessions s JOIN devices d ON d.id=s.device_id AND d.user_id=s.user_id
      WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>now() AND d.revoked_at IS NULL) AS active_session,
    (SELECT max(s.created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login,
    ARRAY(SELECT scope FROM access_entitlements e WHERE e.user_id=u.id AND scope=ANY($2::text[]) ORDER BY scope) AS tracks
    FROM users u WHERE $1::boolean OR u.role='student'
    ORDER BY (u.status='approved') DESC,(u.status='pending') DESC,u.created_at DESC LIMIT 200`,[actor.role==='techadmin',learningTracks])).rows;
}
