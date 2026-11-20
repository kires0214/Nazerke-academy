import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { handleApi } from '../src/lib/api';
import { cookieNames } from '../src/lib/http';
import { hash, principal, type Tokens } from '../src/lib/security';
import { decideRegistration, pendingRegistrationRequests, registrationInvites } from '../src/lib/telegram-access';
import { processTelegramUpdate } from '../src/lib/support';
import { fixture } from './helpers';

const origin = 'https://dev.juicy.invalid';
const telegramId = 900000000000123;
const contact = { user_id: telegramId, first_name: 'Synthetic', last_name: 'Applicant', phone_number: '+12025550101' };
const secret = 'synthetic_dev_webhook_secret_at_least_32';
function configureBot() {
  Object.assign(process.env, {
    APP_BASE_URL: origin, DATABASE_URL: 'postgresql://synthetic.invalid/juicy',
    TELEGRAM_BOT_TOKEN: '999999999:synthetic_dev_only', TELEGRAM_LOGIN_BOT_NAME: 'SyntheticJuicyBot',
    TELEGRAM_WEBHOOK_SECRET: secret,
  });
}

test('a verified bot request stays outside users until Studio invites it, then one-time codes sign in only on the registered browser', async () => {
  configureBot();
  const f = await fixture();
  const originalFetch = globalThis.fetch;
  const messages: { chat_id: string; text: string; reply_markup?: { keyboard: { request_contact: boolean }[][] } }[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'api.telegram.org');
    assert.equal(init?.method, 'POST');
    messages.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, result: { message_id: messages.length } });
  };
  const names = cookieNames();
  const call = (path: string, data?: unknown, options: { tokens?: Tokens; device?: string; origin?: string; secret?: string } = {}) => {
    const cookie = options.tokens
      ? `${names.session}=${options.tokens.session}; ${names.device}=${options.tokens.device}`
      : options.device ? `${names.device}=${options.device}` : '';
    const req = new NextRequest(origin + '/api/' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json', Origin: options.origin ?? origin, Cookie: cookie,
        ...(options.secret ? { 'X-Telegram-Bot-Api-Secret-Token': options.secret } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return handleApi(req, path.split('/'), f.run);
  };
  const update = (id: number, data: object, chat = { id: telegramId, type: 'private' }) => ({
    update_id: id, message: { from: { id: telegramId }, chat, ...data },
  });
  const sendUpdate = (id: number, data: object) => call('telegram/webhook', update(id, data), { secret });
  const codeFromBot = () => {
    const code = messages.at(-1)?.text.match(/Код входа в JUICY: ([\w-]{12})/)?.[1];
    assert.ok(code);
    return code;
  };
  try {
    const tech = await f.account('techadmin');
    const reader = await f.account('admin', 'approved', [], ['students.read']);
    const outsider = await f.account();
    assert.equal((await call('auth/telegram')).status, 410);
    assert.equal((await call('telegram/webhook', update(1, { contact }))).status, 401);
    assert.equal((await call('telegram/webhook', update(2, { contact }, { id: -123, type: 'group' }), { secret })).status, 200);
    assert.equal((await sendUpdate(3, { contact: { ...contact, user_id: telegramId + 1 } })).status, 200);
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length, 0);

    await sendUpdate(4, { text: '/start request' });
    assert.equal(messages.at(-1)?.reply_markup?.keyboard[0][0].request_contact, true);
    assert.match(messages.at(-1)!.text,/Нажмите «Поделиться номером телефона»/);
    assert.equal((await sendUpdate(31,{text:'+12025550101'})).status,200);
    assert.match(messages.at(-1)!.text,/Номер в тексте не подтверждает контакт/);
    assert.equal(messages.at(-1)?.reply_markup?.keyboard[0][0].request_contact,true);
    assert.equal((await f.engine.query('SELECT telegram_id FROM telegram_registration_drafts')).rows.length,0);
    assert.equal((await sendUpdate(5, { contact })).status, 200);
    assert.deepEqual(await (await sendUpdate(5, { contact })).json(), { duplicate: true });
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length,0);
    assert.match(messages.at(-1)!.text,/имя и фамилию/);
    assert.equal((await sendUpdate(21,{text:'Test'})).status,200);
    assert.equal((await sendUpdate(22,{text:'Синтетический Ученик'})).status,200);
    assert.equal((await sendUpdate(23,{text:'Сайт Braun'})).status,200);
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length,0);
    assert.match(messages.at(-1)!.text,/Введите номер заказа/);
    assert.equal((await sendUpdate(24,{text:'BR-DEMO-12345'})).status,200);
    assert.equal((await f.engine.query('SELECT telegram_id FROM telegram_registration_drafts')).rows.length,0);
    const requests = await f.run(db => pendingRegistrationRequests(db, reader.p));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].display_name, 'Синтетический Ученик');
    assert.equal(requests[0].order_source,'braun');
    assert.equal(requests[0].order_number,'BR-DEMO-12345');
    assert.equal(requests[0].phone, contact.phone_number);
    await assert.rejects(f.run(db => pendingRegistrationRequests(db, outsider.p)), /PERMISSION_DENIED/);
    assert.equal((await f.engine.query('SELECT id FROM users WHERE telegram_id=$1', [telegramId])).rows.length, 0);
    await sendUpdate(6, { text: '/start login' });
    assert.equal((await f.engine.query('SELECT code_hash FROM telegram_login_codes')).rows.length, 0);

    const review = 'studio/registration/' + requests[0].id;
    assert.equal((await call(review, { action: 'invite' }, { tokens: reader.tokens })).status, 403);
    assert.equal((await call(review, { action: 'invite' }, { tokens: tech.tokens })).status, 200);
    assert.equal((await call(review, { action: 'invite' }, { tokens: tech.tokens })).status, 409);
    const record = (await f.engine.query("SELECT status,phone,order_source,order_number FROM registration_requests")).rows[0];
    assert.deepEqual(record, { status: 'invited', phone: null, order_source:null,order_number:null });
    assert.ok((await f.engine.query("SELECT id FROM notification_outbox WHERE chat_id=$1 AND body LIKE '%/login%'", [telegramId])).rows.length);

    await sendUpdate(7, { text: '/start login' });
    const expired = codeFromBot();
    await f.engine.query("UPDATE telegram_login_codes SET expires_at=now()-interval '1 second'");
    assert.equal((await call('auth/telegram', { code: expired })).status, 401);
    await sendUpdate(8, { text: '/login' });
    const code = codeFromBot();
    assert.deepEqual((await f.engine.query("SELECT code_hash FROM telegram_login_codes")).rows, [{ code_hash: hash(code) }]);
    assert.equal((await call('auth/telegram', { code }, { origin: 'https://elsewhere.invalid' })).status, 403);
    const result = await call('auth/telegram', { code });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).destination, '/academy');
    const tokens = {
      session: result.cookies.get(names.session)?.value,
      device: result.cookies.get(names.device)?.value,
    };
    const approved = await f.run(db => principal(db, tokens));
    assert.equal(approved.role, 'student');
    assert.deepEqual(approved.scopes.sort(), ['academy','kenwood']);
    assert.equal((await call('auth/telegram', { code })).status, 401);

    await sendUpdate(9, { text: '/login' });
    const replacement = codeFromBot();
    assert.equal((await call('auth/telegram', { code: replacement })).status, 409);
    assert.equal((await call('auth/telegram', { code: replacement }, { device: tokens.device })).status, 200);
    await assert.rejects(f.run(db => principal(db, tokens)), /SESSION_INVALID/);

    const staffChat=Number(tech.telegramId);
    const staffUpdate={
      update_id:10,message:{from:{id:staffChat},chat:{id:staffChat,type:'private'},text:'/login'},
    };
    assert.equal((await call('telegram/webhook',staffUpdate,{secret})).status,200);
    const staffLogin=await call('auth/telegram',{code:codeFromBot()},{device:tech.tokens.device});
    assert.equal(staffLogin.status,200);
    assert.equal((await staffLogin.json()).destination,'/admin');
    const newStaff={session:staffLogin.cookies.get(names.session)?.value,device:staffLogin.cookies.get(names.device)?.value};
    await sendUpdate(32,{text:'/login'});
    const preArchive=codeFromBot();
    const account='studio/accounts/'+approved.id;
    assert.equal((await call(account,{action:'archive'},{tokens:newStaff})).status,200);
    assert.equal((await call('auth/telegram',{code:preArchive},{device:tokens.device})).status,401);
    await sendUpdate(33,{text:'/login'});
    assert.match(messages.at(-1)!.text,/Доступ приостановлен/);
    assert.equal((await call(account,{action:'delete'},{tokens:newStaff})).status,200);
    assert.equal((await f.engine.query('SELECT id FROM registration_requests WHERE telegram_id=$1',[telegramId])).rows.length,0);
    await sendUpdate(34,{text:'/start request'});
    assert.equal(messages.at(-1)?.reply_markup?.keyboard[0][0].request_contact,true);
    for(const [id,data] of [[35,{contact}],[36,{text:'Синтетический Ученик'}],[37,{text:'Kaspi'}],[38,{text:'TEST-123'}]] as const)
      assert.equal((await sendUpdate(id,data)).status,200);
    const again=await f.run(db=>pendingRegistrationRequests(db,tech.p));
    assert.equal(again.length,1);
    assert.notEqual(again[0].id,requests[0].id);
    assert.equal((await call('studio/registration/'+again[0].id,{action:'invite'},{tokens:newStaff})).status,200);
    const identity=(await f.engine.query<{id:string}>('SELECT id FROM users WHERE telegram_id=$1',[telegramId])).rows[0];
    assert.notEqual(identity.id,approved.id);
  } finally {
    globalThis.fetch = originalFetch;
    await f.close();
  }
});

test('Studio links skip order details once, preserve approval, and can be revoked or expire', async () => {
  configureBot();
  const f=await fixture();
  const replies:string[]=[];
  const send=async (_id:string,message:string)=>{replies.push(message);return String(replies.length);};
  let updateId=100;
  const run=(id:number,text?:string,details?:typeof contact)=>f.run(db=>processTelegramUpdate(db,{
    update_id:++updateId,message:{from:{id},chat:{type:'private',id},text,contact:details},
  },send));
  const names=cookieNames();
  const call=(path:string,tokens:Tokens,method='POST')=>handleApi(new NextRequest(origin+'/api/'+path,{
    method,headers:{Origin:origin,Cookie:`${names.session}=${tokens.session}; ${names.device}=${tokens.device}`},
  }),path.split('/'),f.run);

  try{
    const tech=await f.account('techadmin');
    const reader=await f.account('admin','approved',[],['students.read']);
    const approver=await f.account('admin','approved',[],['students.read','students.approve']);
    const student=await f.account();
    const create=async(tokens=tech.tokens)=>{
      const response=await call('studio/invitations',tokens);
      assert.equal(response.status,200);
      assert.match(response.headers.get('cache-control')??'',/no-store/);
      const {id,url}=await response.json() as {id:string;url:string};
      const link=new URL(url);
      assert.equal(link.origin,'https://t.me');
      assert.equal(link.pathname,'/SyntheticJuicyBot');
      const payload=link.searchParams.get('start')!;
      assert.match(payload,/^invite_[A-Za-z0-9_-]{32}$/);
      return {id,start:'/start '+payload,token:payload.slice(7)};
    };
    assert.equal((await call('studio/invitations',reader.tokens)).status,403);
    assert.equal((await call('studio/invitations',student.tokens)).status,403);
    const invite=await create(approver.tokens);
    const stored=(await f.engine.query<{token_hash:string}>('SELECT token_hash FROM registration_invites')).rows[0];
    assert.equal(stored.token_hash,hash(invite.token));
    assert.equal((await call('studio/invitations/'+invite.id,reader.tokens,'DELETE')).status,403);
    await assert.rejects(f.run(db=>registrationInvites(db,reader.p)),/PERMISSION_DENIED/);

    const first=telegramId+42,second=telegramId+43;
    await run(first,invite.start);
    assert.match(replies.at(-1)!,/Затем бот спросит имя и фамилию/);
    await run(first,undefined,contact);
    await run(first,'Synthetic Learner');
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length,0);
    await run(first,undefined,{...contact,user_id:first});
    await run(first,'Synthetic');
    assert.match(replies.at(-1)!,/Введите ваше имя и фамилию/);
    await run(second,invite.start);
    await run(second,undefined,{...contact,user_id:second});
    await run(first,'Synthetic Learner');
    assert.match(replies.at(-1)!,/Заявка отправлена/);
    await run(second,'Synthetic Second');
    assert.match(replies.at(-1)!,/Ссылка недействительна/);
    await run(second,invite.start);
    assert.match(replies.at(-1)!,/Ссылка недействительна/);
    const [request]=await f.run(db=>pendingRegistrationRequests(db,tech.p));
    assert.equal(request.invite_id,invite.id);
    assert.equal(request.display_name,'Synthetic Learner');
    assert.equal(request.order_source,null);
    assert.equal(request.order_number,null);
    assert.equal((await f.engine.query('SELECT id FROM users WHERE telegram_id=$1',[first])).rows.length,0);
    await run(first,'/login');
    assert.match(replies.at(-1)!,/Заявка уже отправлена/);
    assert.equal((await call('studio/invitations/'+invite.id,tech.tokens,'DELETE')).status,409);

    const revoked=await create();
    await run(second,revoked.start);
    assert.equal((await call('studio/invitations/'+revoked.id,tech.tokens,'DELETE')).status,200);
    await run(second,'Synthetic Second');
    assert.match(replies.at(-1)!,/Ссылка недействительна/);

    const expired=await create();
    await f.engine.query("UPDATE registration_invites SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired.id]);
    await run(second,expired.start);
    assert.match(replies.at(-1)!,/Ссылка недействительна/);
    await run(second,'/start invite_'+'X'.repeat(32));
    assert.match(replies.at(-1)!,/Ссылка недействительна/);
    const switchable=await create();
    await run(second,switchable.start);
    await run(second,'/start request');
    await run(second,'Synthetic Second');
    assert.match(replies.at(-1)!,/Где оформлен заказ/);
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length,1);
    await f.run(db=>decideRegistration(db,approver.p,request.id,{action:'invite',role:'student',grants:[]}));
    await run(first,'/login');
    assert.match(replies.at(-1)!,/Код входа в JUICY:/);

    const list=await f.run(db=>registrationInvites(db,tech.p));
    assert.deepEqual(Object.fromEntries(list.map(row=>[row.id,row.status])),
      {[expired.id]:'expired',[revoked.id]:'revoked',[invite.id]:'used',[switchable.id]:'active'});
    assert.ok(list.every(row=>!('token_hash' in row)));
  } finally {
    await f.close();
  }
});
