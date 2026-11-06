import { z } from 'zod';
import type { Db } from './db';
import { check } from './errors';
import { hasGrant, requireGrant, rateLimit, type Principal } from './security';
import { telegramSend } from './providers';

export async function supportMessage(db:Db,user:Principal,body:string,threadId?:string) {
  await rateLimit(db,'support:'+user.id,12);
  let thread;
  if(threadId) {
    requireGrant(user,'support.respond');
    thread=(await db.query<{id:string;user_id:string}>('SELECT id,user_id FROM support_threads WHERE id=$1 FOR UPDATE',[threadId])).rows[0];
    check(thread,404,'THREAD_NOT_FOUND');
  } else {
    thread=(await db.query<{id:string;user_id:string}>(`INSERT INTO support_threads(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET status='open',updated_at=now() RETURNING id,user_id`,[user.id])).rows[0];
  }
  await db.query('INSERT INTO support_messages(thread_id,actor_id,sender,body) VALUES($1,$2,$3,$4)',[thread.id,user.id,threadId?'human':'student',body]);
  await db.query("UPDATE support_threads SET updated_at=now(),status='open' WHERE id=$1",[thread.id]);
  if(threadId) {
    await db.query('INSERT INTO notification_outbox(chat_id,body) SELECT telegram_id,$2 FROM users WHERE id=$1 AND telegram_opt_in AND status=\'approved\'',[thread.user_id,'Ответ сотрудника JUICY: '+body]);
  } else if(process.env.TELEGRAM_SUPPORT_CHAT_ID) {
    await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)',[process.env.TELEGRAM_SUPPORT_CHAT_ID,`Обращение ${thread.id}\n${body}\nОтвет: /reply ${thread.id} текст`]);
  }
  return thread.id;
}
export async function supportHistory(db:Db,user:Principal,staff=false) {
  if(staff) requireGrant(user,'support.read');
  return (await db.query(`SELECT m.id,m.thread_id,m.sender,m.body,m.created_at FROM support_messages m JOIN support_threads t ON t.id=m.thread_id
    WHERE ($2::boolean OR t.user_id=$1) ORDER BY m.created_at DESC LIMIT 200`,[user.id,staff])).rows;
}
const updateSchema=z.object({update_id:z.number().int().nonnegative(),message:z.object({
  from:z.object({id:z.number().int().positive()}).passthrough(),chat:z.object({id:z.number().int(),type:z.string()}).passthrough(),
  text:z.string().max(4000).optional(),
}).passthrough().optional()}).passthrough();
export async function processTelegramUpdate(db:Db,raw:unknown) {
  const update=updateSchema.parse(raw);
  const receipt=await db.query('INSERT INTO telegram_updates(update_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING update_id',[update.update_id]);
  if(!receipt.rows.length) return {duplicate:true};
  const message=update.message;
  if(!message?.text) return {ok:true};
  const user=(await db.query<Principal & {telegram_id:string}>('SELECT id,display_name,role,status,telegram_id FROM users WHERE telegram_id=$1 FOR SHARE',[message.from.id])).rows[0];
  if(!user) return {ok:true};
  if(message.chat.type==='private' && message.chat.id===message.from.id) {
    if(message.text==='/start') {
      await db.query('UPDATE users SET telegram_opt_in=true WHERE id=$1',[user.id]);
      await db.query('INSERT INTO notification_outbox(chat_id,body) VALUES($1,$2)',[message.from.id,'JUICY: уведомления включены. Ответы поддержки отправляет сотрудник. /stop — отключить.']);
    } else if(message.text==='/stop') {
      await db.query('UPDATE users SET telegram_opt_in=false WHERE id=$1',[user.id]);
      await db.query("DELETE FROM notification_outbox WHERE chat_id=$1 AND state='pending'",[message.from.id]);
    } else if(user.status==='approved') {
      await supportMessage(db,{...user,grants:[],scopes:[]},message.text);
    }
  } else if(String(message.chat.id)===process.env.TELEGRAM_SUPPORT_CHAT_ID && user.status==='approved') {
    const permissions=(await db.query<{permission:string}>('SELECT permission FROM admin_grants WHERE user_id=$1',[user.id])).rows;
    const actor={...user,grants:permissions.map(x=>x.permission),scopes:[]};
    const match=message.text.match(/^\/reply ([a-f0-9-]{36}) ([\s\S]+)$/);
    if(match && hasGrant(actor,'support.respond')) await supportMessage(db,actor,match[2],z.uuid().parse(match[1]));
  }
  return {ok:true};
}

export async function dispatchOutbox(db:Db) {
  // Caller commits claims first; send after the claim transaction, then acknowledge.
  await db.query("UPDATE notification_outbox SET state='failed' WHERE state='sending' AND attempts>=5 AND next_attempt_at<=now()");
  return (await db.query<{id:string;chat_id:string;body:string}>(`UPDATE notification_outbox SET state='sending',attempts=attempts+1,next_attempt_at=now()+interval '2 minutes'
    WHERE id IN (SELECT id FROM notification_outbox WHERE (state='pending' OR state='sending') AND next_attempt_at<=now() AND attempts<5
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 3) RETURNING id,chat_id,body`)).rows;
}
export async function deliverClaimed(db:Db,items:Awaited<ReturnType<typeof dispatchOutbox>>,send=telegramSend) {
  for(const item of items) {
    try { const messageId=await send(String(item.chat_id),item.body);
      await db.query("UPDATE notification_outbox SET state='sent',telegram_message_id=$2 WHERE id=$1",[item.id,messageId]);
    } catch {
      await db.query("UPDATE notification_outbox SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt_at=now()+interval '2 minutes' WHERE id=$1",[item.id]);
    }
  }
}
