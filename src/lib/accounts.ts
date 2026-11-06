import { z } from 'zod';
import type { Db } from './db';
import { check } from './errors';
import { audit, grants, requireGrant, type Principal } from './security';

export const accountSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('approve')}).strict(), z.object({action:z.literal('block')}).strict(),
  z.object({action:z.literal('ambassador'),enabled:z.boolean()}).strict(),
  z.object({action:z.literal('staff'),role:z.enum(['student','admin']),grants:z.array(z.enum(grants)).max(grants.length)}).strict(),
  z.object({action:z.literal('learning'),enabled:z.boolean()}).strict(),
]);
export async function updateAccount(db:Db,actor:Principal,userId:string,raw:unknown) {
  const input=accountSchema.parse(raw);
  if(input.action==='approve') requireGrant(actor,'students.approve');
  if(input.action==='block') requireGrant(actor,'students.block');
  if(input.action==='ambassador') requireGrant(actor,'ambassadors.assign');
  if(['staff','learning'].includes(input.action)) check(actor.role==='techadmin',403,'TECHADMIN_ONLY');
  const target=(await db.query<{id:string;role:string;status:string;telegram_id:string;telegram_opt_in:boolean}>('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
  check(target,404,'USER_NOT_FOUND');
  check(target.role!=='techadmin',403,'TECHADMIN_PROTECTED');
  check(actor.role==='techadmin'||target.role!=='admin',403,'STAFF_TECHADMIN_ONLY');
  if(input.action==='approve') {
    check(target.status==='pending',409,'USER_NOT_PENDING');
    await db.query("UPDATE users SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",[userId,actor.id]);
    if(['student','ambassador'].includes(target.role)) await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'academy',$2) ON CONFLICT DO NOTHING",[userId,actor.id]);
    if(target.telegram_opt_in) await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)',[target.telegram_id,'Доступ к JUICY Academy подтверждён.']);
  }
  if(input.action==='block') {
    await db.query("UPDATE users SET status='blocked' WHERE id=$1",[userId]);
  }
  if(input.action==='staff') {
    await db.query('UPDATE users SET role=$2 WHERE id=$1',[userId,input.role]);
    await db.query('DELETE FROM admin_grants WHERE user_id=$1',[userId]);
    await db.query('DELETE FROM access_entitlements WHERE user_id=$1',[userId]);
    if(input.role==='admin') for(const grant of new Set(input.grants)) await db.query('INSERT INTO admin_grants(user_id,permission,granted_by) VALUES($1,$2,$3)',[userId,grant,actor.id]);
  }
  if(input.action==='ambassador') {
    check(['student','ambassador'].includes(target.role)&&target.status==='approved',409,'APPROVED_LEARNER_REQUIRED');
    await db.query('UPDATE users SET role=$2 WHERE id=$1',[userId,input.enabled?'ambassador':'student']);
    await db.query("DELETE FROM access_entitlements WHERE user_id=$1 AND scope='ambassador'",[userId]);
    if(input.enabled) await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'ambassador',$2)",[userId,actor.id]);
  }
  if(input.action==='learning') {
    await db.query("DELETE FROM access_entitlements WHERE user_id=$1 AND scope='academy'",[userId]);
    if(input.enabled) await db.query("INSERT INTO access_entitlements(user_id,scope,granted_by) VALUES($1,'academy',$2)",[userId,actor.id]);
  }
  if(input.action!=='approve') await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  await audit(db,actor.id,'account.'+input.action,userId,input.action==='staff'?{role:input.role,grants:input.grants}:{});
}
