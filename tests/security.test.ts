import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,syntheticPrincipal } from './helpers';
import { canLearn,createLogin,hasGrant,hash,principal,resetDevice } from '../src/lib/security';
import { updateAccount } from '../src/lib/accounts';

test('five-role authorization matrix keeps staff grants separate from learning',()=>{
  const student=syntheticPrincipal('student'),ambassador=syntheticPrincipal('ambassador',[],['academy','ambassador']);
  const admin=syntheticPrincipal('admin',['content.edit'],[]),tech=syntheticPrincipal('techadmin');
  assert.equal(canLearn(syntheticPrincipal('guest',[],[]),'academy'),false);
  assert.equal(canLearn(student,'academy'),true);assert.equal(canLearn(student,'ambassador'),false);
  assert.equal(canLearn(ambassador,'ambassador'),true);assert.equal(canLearn(admin,'academy'),false);
  assert.equal(hasGrant(admin,'content.edit'),true);assert.equal(hasGrant(admin,'content.publish'),false);
  assert.equal(hasGrant(student,'content.edit'),false);assert.equal(hasGrant(tech,'content.publish'),true);
  assert.equal(canLearn({...student,status:'pending'},'academy'),false);
  assert.equal(canLearn({...ambassador,scopes:['academy']},'ambassador'),false);
});
test('login cannot register; pending users remain denied and only the registered browser can replace its session',async()=>{
  const f=await fixture();try {
    await assert.rejects(f.run(db=>createLogin(db,'900000000000099')),/INVITE_REQUIRED/);
    assert.equal((await f.engine.query('SELECT id FROM users')).rows.length,0);
    const pending=await f.account('student','pending',[]);
    await assert.rejects(f.run(db=>principal(db,pending.tokens)),/APPROVAL_REQUIRED/);
    await assert.rejects(f.run(db=>createLogin(db,pending.telegramId,pending.tokens.device)),/INVITE_REQUIRED/);
    const a=await f.account();
    await assert.rejects(f.run(db=>createLogin(db,a.telegramId)),/BROWSER_REGISTERED/);
    const replaced=await f.run(db=>createLogin(db,a.telegramId,a.tokens.device));
    await assert.rejects(f.run(db=>principal(db,a.tokens)),/SESSION_INVALID/);
    const stored=(await f.engine.query<{token_hash:string}>('SELECT token_hash FROM sessions WHERE revoked_at IS NULL')).rows;
    assert.ok(stored.some(r=>r.token_hash===hash(replaced.sessionToken)));assert.ok(stored.every(r=>r.token_hash!==replaced.sessionToken));
    await assert.rejects(f.run(db=>principal(db,{session:replaced.sessionToken,device:'cleared-or-forged'},true)),/SESSION_INVALID/);
  }finally{await f.close();}
});
test('concurrent first browser attempts serialize to one registration and one active session',async()=>{
  const f=await fixture();try {
    const telegramId='900000000000099';
    await f.engine.query("INSERT INTO users(telegram_id,display_name,status) VALUES($1,'Synthetic race','approved')",[telegramId]);
    const attempts=await Promise.allSettled([f.run(db=>createLogin(db,telegramId)),f.run(db=>createLogin(db,telegramId))]);
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    assert.equal((await f.engine.query('SELECT id FROM devices WHERE revoked_at IS NULL')).rows.length,1);
    assert.equal((await f.engine.query('SELECT id FROM sessions WHERE revoked_at IS NULL')).rows.length,1);
    // PGlite serializes transactions; independent Neon connection race remains a live DEV gate.
  }finally{await f.close();}
});
test('database unique constraints independently reject extra active devices and sessions',async()=>{
  const f=await fixture();try {const a=await f.account();
    await assert.rejects(f.engine.query('INSERT INTO devices(user_id,binding_hash) VALUES($1,$2)',[a.id,hash('second')]),/unique/i);
    await assert.rejects(f.engine.query("INSERT INTO sessions(user_id,device_id,token_hash,expires_at) SELECT user_id,device_id,$2,now()+interval '1 day' FROM sessions WHERE user_id=$1 LIMIT 1",[a.id,hash('extra')]),/unique/i);
  }finally{await f.close();}
});
test('approval, device recovery and blocked/expired/revoked sessions are enforced and audited',async()=>{
  const f=await fixture();try {const tech=await f.account('techadmin'),a=await f.account('student','pending',[]);
    await f.run(db=>updateAccount(db,tech.p,a.id,{action:'approve'}));assert.equal((await f.run(db=>principal(db,a.tokens))).scopes.includes('academy'),true);
    await f.run(db=>resetDevice(db,tech.p,a.id));await assert.rejects(f.run(db=>principal(db,a.tokens)),/SESSION_INVALID/);
    const login=await f.run(db=>createLogin(db,a.telegramId));
    const tokens={session:login.sessionToken,device:login.deviceToken};await f.engine.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[a.id]);
    await assert.rejects(f.run(db=>principal(db,tokens)),/SESSION_INVALID/);
    assert.ok((await f.engine.query("SELECT id FROM audit_events WHERE operation='device.reset'")).rows.length);
    await assert.rejects(f.engine.query("UPDATE audit_events SET operation='tampered'"),/append-only/);
    await f.engine.query("UPDATE users SET status='blocked' WHERE id=$1",[tech.id]);await assert.rejects(f.run(db=>principal(db,tech.tokens)),/ACCOUNT_BLOCKED/);
  }finally{await f.close();}
});
test('only Tech Admin changes grants; admin cannot self-escalate or reset staff devices',async()=>{
  const f=await fixture();try {const tech=await f.account('techadmin'),admin=await f.account('admin','approved',[],['devices.reset','students.approve']),student=await f.account();
    await assert.rejects(f.run(db=>updateAccount(db,admin.p,admin.id,{action:'staff',role:'admin',grants:['content.publish']})),/TECHADMIN_ONLY/);
    await assert.rejects(f.run(db=>resetDevice(db,admin.p,tech.id)),/STAFF_TECHADMIN_ONLY/);
    await f.run(db=>updateAccount(db,tech.p,student.id,{action:'staff',role:'admin',grants:['content.edit','content.read']}));
    await assert.rejects(f.run(db=>principal(db,student.tokens)),/SESSION_INVALID/);
    assert.equal((await f.engine.query('SELECT * FROM access_entitlements WHERE user_id=$1',[student.id])).rows.length,0);
    assert.equal((await f.engine.query('SELECT * FROM admin_grants WHERE user_id=$1',[student.id])).rows.length,2);
    assert.ok((await f.engine.query("SELECT id FROM audit_events WHERE operation='account.staff'")).rows.length);
  }finally{await f.close();}
});
