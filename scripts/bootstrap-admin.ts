import { withDb } from '../src/lib/db';
import { audit } from '../src/lib/security';
import { check } from '../src/lib/errors';
const id=process.env.BOOTSTRAP_TECHADMIN_TELEGRAM_ID;
check(id&&/^[1-9][0-9]{0,15}$/.test(id),400,'BOOTSTRAP_ID_REQUIRED');
await withDb(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(719481032)');
  const existing=(await db.query("SELECT id FROM users WHERE role='techadmin'")).rows;
  check(!existing.length,409,'TECHADMIN_ALREADY_EXISTS');
  const request=(await db.query<{id:string;display_name:string}>(`SELECT id,display_name FROM registration_requests
    WHERE telegram_id=$1 AND status='requested' AND (invite_id IS NOT NULL OR order_source IS NOT NULL) FOR UPDATE`,[id])).rows[0];
  if(request) {
    await db.query('INSERT INTO users(telegram_id,display_name) VALUES($1,$2) ON CONFLICT(telegram_id) DO NOTHING',[id,request.display_name]);
    await db.query("UPDATE registration_requests SET status='invited',phone=NULL,order_source=NULL,order_number=NULL,reviewed_at=now() WHERE id=$1",[request.id]);
  }
  const user=(await db.query<{id:string}>("SELECT id FROM users WHERE telegram_id=$1 AND status<>'blocked' FOR UPDATE",[id])).rows[0];
  check(user,404,'REQUEST_INVITATION_IN_TELEGRAM_FIRST');
  await db.query("UPDATE users SET role='techadmin',status='approved',approved_at=now() WHERE id=$1",[user.id]);
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1',[user.id]);
  await audit(db,user.id,'system.bootstrap_techadmin',user.id);
});
console.log('PASS: initial Tech Admin assigned; remove bootstrap environment key and request a Telegram login code');
