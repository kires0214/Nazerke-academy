import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { handleApi } from '../src/lib/api';
import { cookieNames } from '../src/lib/http';
import { hash, principal, type Tokens } from '../src/lib/security';
import { pendingRegistrationRequests } from '../src/lib/telegram-access';
import { fixture } from './helpers';

const origin = 'https://dev.juicy.invalid';
const telegramId = 900000000000123;
const contact = { user_id: telegramId, first_name: 'Synthetic', last_name: 'Applicant', phone_number: '+12025550101' };
const secret = 'synthetic_dev_webhook_secret_at_least_32';

test('a verified bot request stays outside users until Studio invites it, then one-time codes sign in only on the registered browser', async () => {
  Object.assign(process.env, {
    APP_BASE_URL: origin, DATABASE_URL: 'postgresql://synthetic.invalid/juicy',
    TELEGRAM_BOT_TOKEN: '999999999:synthetic_dev_only', TELEGRAM_LOGIN_BOT_NAME: 'SyntheticJuicyBot',
    TELEGRAM_WEBHOOK_SECRET: secret,
  });
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
    assert.equal((await sendUpdate(5, { contact })).status, 200);
    assert.deepEqual(await (await sendUpdate(5, { contact })).json(), { duplicate: true });
    assert.equal((await f.engine.query('SELECT id FROM registration_requests')).rows.length,0);
    assert.match(messages.at(-1)!.text,/имя и фамилию/);
    assert.equal((await sendUpdate(21,{text:'Test'})).status,200);
    assert.equal((await sendUpdate(22,{text:'Синтетический Ученик'})).status,200);
    assert.equal((await sendUpdate(23,{text:'Сайт Braun'})).status,200);
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
  } finally {
    globalThis.fetch = originalFetch;
    await f.close();
  }
});
