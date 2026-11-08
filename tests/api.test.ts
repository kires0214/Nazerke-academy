import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fixture } from './helpers';
import { handleApi } from '../src/lib/api';
import { cookieNames } from '../src/lib/http';
import { contentSchema,saveContent } from '../src/lib/content';
import { deliverClaimed,dispatchOutbox,processTelegramUpdate } from '../src/lib/support';
import { telegramSend } from '../src/lib/providers';
import { downloadSignature,type Tokens } from '../src/lib/security';

process.env.APP_BASE_URL='https://dev.juicy.invalid';process.env.APP_ENV='DEV';
function request(path:string,method='GET',body?:unknown,tokens?:Tokens,origin='https://dev.juicy.invalid',extra:Record<string,string>={}) {
  const names=cookieNames();return new NextRequest('https://dev.juicy.invalid/api/'+path,{method,
    headers:{'Content-Type':'application/json',Origin:origin,...(tokens?{Cookie:`${names.session}=${tokens.session}; ${names.device}=${tokens.device}`} : {}),...extra},
    body:body===undefined?undefined:JSON.stringify(body)});
}
test('HTTP APIs reject forged cookies, pending accounts, cross-origin writes and IDOR payloads',async()=>{
  const f=await fixture();try {const a=await f.account(),pending=await f.account('student','pending',[]);
    for(const path of ['profile','studio/accounts','studio/audit','support'])assert.equal((await handleApi(request(path),path.split('/'),f.run)).status,401);
    assert.equal((await handleApi(request('profile','GET',undefined,{session:'techadmin',device:'admin'}),['profile'],f.run)).status,401);
    assert.equal((await handleApi(request('profile','GET',undefined,pending.tokens),['profile'],f.run)).status,403);
    assert.equal((await handleApi(request('studio/accounts','GET',undefined,a.tokens),['studio','accounts'],f.run)).status,403);
    const node=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];
    assert.equal((await handleApi(request('favorites','POST',{contentId:node.id,enabled:true},a.tokens,'https://evil.invalid'),['favorites'],f.run)).status,403);
    assert.equal((await handleApi(request('favorites','POST',{contentId:node.id,enabled:true,userId:pending.id},a.tokens),['favorites'],f.run)).status,400);
    for(let i=0;i<2;i++)assert.equal((await handleApi(request('favorites','POST',{contentId:node.id,enabled:true},a.tokens),['favorites'],f.run)).status,200);
    assert.equal((await f.engine.query('SELECT * FROM favorites WHERE user_id=$1',[a.id])).rows.length,1);
    const second=await f.account();const profile=await handleApi(request('profile','GET',undefined,second.tokens),['profile'],f.run);
    assert.deepEqual((await profile.json()).favorites,[]);
    await handleApi(request('auth/logout','POST',{},a.tokens),['auth','logout'],f.run);
    assert.equal((await handleApi(request('profile','GET',undefined,a.tokens),['profile'],f.run)).status,401);
  }finally{await f.close();}
});
test('direct CMS endpoint enforces granular grants and forbids spoofed role fields',async()=>{
  const f=await fixture();try {const a=await f.account('admin','approved',[],['content.edit','recipes.manage']);
    const recipe={kind:'recipe',slug:'api-recipe',title:'Synthetic API recipe',status:'published',data:{duration:5,portions:1,ingredients:['Synthetic ingredient'],steps:['Synthetic step']}};
    const response=await handleApi(request('studio/content','POST',recipe,a.tokens),['studio','content'],f.run);
    assert.equal(response.status,403);assert.equal((await response.json()).error,'PERMISSION_DENIED');
    assert.equal((await handleApi(request('studio/accounts/'+a.id,'POST',{action:'staff',role:'admin',grants:['content.publish']},a.tokens),['studio','accounts',a.id],f.run)).status,403);
  }finally{await f.close();}
});
test('Telegram webhook validates secret, deduplicates updates and records support roundtrip',async()=>{
  const f=await fixture();process.env.TELEGRAM_WEBHOOK_SECRET='synthetic_DEV_webhook_secret_32_characters';process.env.TELEGRAM_SUPPORT_CHAT_ID='-900000000000001';
  try {const a=await f.account(),staff=await f.account('admin','approved',[],['support.read','support.respond']);
    const update={update_id:1,message:{from:{id:Number(a.telegramId)},chat:{id:Number(a.telegramId),type:'private'},text:'/start'}};
    assert.equal((await handleApi(request('telegram/webhook','POST',update),['telegram','webhook'],f.run)).status,401);
    const call=()=>handleApi(request('telegram/webhook','POST',update,undefined,'https://not-used.invalid',{'x-telegram-bot-api-secret-token':process.env.TELEGRAM_WEBHOOK_SECRET!}),['telegram','webhook'],f.run);
    assert.equal((await call()).status,200);assert.equal((await (await call()).json()).duplicate,true);
    assert.equal((await f.engine.query('SELECT id FROM notification_outbox')).rows.length,1);
    const own=await handleApi(request('support','POST',{body:'Synthetic help request'},a.tokens),['support'],f.run);const {threadId}=await own.json();
    const incoming={update_id:2,message:{from:{id:Number(staff.telegramId)},chat:{id:Number(process.env.TELEGRAM_SUPPORT_CHAT_ID),type:'supergroup'},text:`/reply ${threadId} Synthetic human answer`}};
    await f.run(db=>processTelegramUpdate(db,incoming));await f.run(db=>processTelegramUpdate(db,incoming));
    const history=await handleApi(request('support','GET',undefined,a.tokens),['support'],f.run);const messages=await history.json();
    assert.equal(messages.length,2);assert.equal(messages.filter((m:{sender:string})=>m.sender==='human').length,1);
    const other=await f.account();assert.deepEqual(await (await handleApi(request('support','GET',undefined,other.tokens),['support'],f.run)).json(),[]);
    const noGrant=await f.account('admin','approved',[],[]);
    await f.run(db=>processTelegramUpdate(db,{...incoming,update_id:3,message:{...incoming.message,from:{id:Number(noGrant.telegramId)}}}));
    assert.equal((await f.engine.query('SELECT id FROM support_messages')).rows.length,2);
  }finally{await f.close();delete process.env.TELEGRAM_SUPPORT_CHAT_ID;}
});
test('outbox retries provider failures and preserves sent state without duplicate claims',async()=>{
  const f=await fixture();try {
    await f.engine.query("INSERT INTO notification_outbox(chat_id,body) VALUES(900000000000001,'Synthetic notification')");
    let items=await f.run(dispatchOutbox);assert.equal(items.length,1);assert.equal((await f.run(dispatchOutbox)).length,0);
    await f.run(db=>deliverClaimed(db,items,async()=>{throw new Error('Synthetic provider failure');}));
    assert.equal((await f.engine.query<{state:string}>('SELECT state FROM notification_outbox')).rows[0].state,'pending');
    await f.engine.query("UPDATE notification_outbox SET next_attempt_at=now()-interval '1 second'");items=await f.run(dispatchOutbox);
    await f.run(db=>deliverClaimed(db,items,async()=>'12345'));
    assert.equal((await f.engine.query<{state:string}>('SELECT state FROM notification_outbox')).rows[0].state,'sent');
    assert.equal((await f.run(dispatchOutbox)).length,0);
  }finally{await f.close();}
});
test('private files and video endpoints deny pending users, unentitled staff, hidden content and missing authentication',async()=>{
  const f=await fixture();process.env.TELEGRAM_BOT_TOKEN='999999999:synthetic_DEV_signing_only';try {const student=await f.account(),pending=await f.account('student','pending',[]),staff=await f.account('admin','approved',[],['content.read']);
    const recipe=(await f.engine.query<{id:string}>("SELECT id FROM content WHERE slug='pasta'")).rows[0];
    const media=(await f.engine.query<{id:string}>("INSERT INTO media(kind,provider,mime,bytes,state,created_by) VALUES('document','postgres','application/pdf',$1,'ready',$2) RETURNING id",[Buffer.from('%PDF-Synthetic DEV'),student.id])).rows[0];
    await f.engine.query('INSERT INTO content_media(content_id,media_id) VALUES($1,$2)',[recipe.id,media.id]);
    const path=['media',media.id,'file'];
    for(const [tokens,status] of [[undefined,401],[pending.tokens,403],[staff.tokens,403]] as const)assert.equal((await handleApi(request(path.join('/'),'GET',undefined,tokens),path,f.run)).status,status);
    assert.equal((await handleApi(request(path.join('/'),'GET',undefined,student.tokens),path,f.run)).status,403);
    const ticket=await handleApi(request(`media/${media.id}/download`,'GET',undefined,student.tokens),['media',media.id,'download'],f.run);const {url}=await ticket.json();
    const response=await handleApi(new NextRequest('https://dev.juicy.invalid'+url,{headers:{Cookie:request('profile','GET',undefined,student.tokens).headers.get('Cookie')!}}),path,f.run);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.match(response.headers.get('Cache-Control')!,/no-store/);
    const expired=Math.floor(Date.now()/1000)-1,sig=downloadSignature(media.id,student.tokens.session!,expired);
    assert.equal((await handleApi(request(path.join('/')+`?expires=${expired}&signature=${sig}`,'GET',undefined,student.tokens),path,f.run)).status,403);
    await f.engine.query("UPDATE content SET status='hidden' WHERE id=$1",[recipe.id]);assert.equal((await handleApi(request(path.join('/'),'GET',undefined,student.tokens),path,f.run)).status,403);
  }finally{await f.close();}
});
test('event capacity transaction produces registration and waitlist, and idempotent repeat',async()=>{
  const f=await fixture();try {const tech=await f.account('techadmin'),a=await f.account(),b=await f.account();
    const id=await f.run(db=>saveContent(db,tech.p,{kind:'event',slug:'synthetic-event',title:'Synthetic DEV event',status:'published',data:{city:'Synthetic city',startsAt:new Date(Date.now()+86400000).toISOString(),capacity:1}}));
    const path=['events',id,'register'];const responses=await Promise.all([a,b].map(user=>handleApi(request(path.join('/'),'POST',{},user.tokens),path,f.run)));
    const statuses=await Promise.all(responses.map(r=>r.json()));assert.deepEqual(statuses.map(x=>x.status).sort(),['registered','waitlist']);
    const repeat=await handleApi(request(path.join('/'),'POST',{},a.tokens),path,f.run);assert.equal((await repeat.json()).status,statuses[0].status);
  }finally{await f.close();}
});
test('Telegram delivery adapter uses POST, no formatting injection, and reports provider failures safely',async()=>{
  const saved=process.env.TELEGRAM_BOT_TOKEN;process.env.TELEGRAM_BOT_TOKEN='999999999:synthetic_DEV_only';
  try {assert.equal(await telegramSend('900000000000001','<b>Synthetic text</b>',async(url,init)=>{assert.equal(init?.method,'POST');assert.equal(JSON.parse(String(init.body)).parse_mode,undefined);return Response.json({ok:true,result:{message_id:42}});}), '42');
    await assert.rejects(telegramSend('900000000000001','Synthetic',async()=>Response.json({ok:false},{status:429})),/TELEGRAM_UNAVAILABLE/);
  }finally{if(saved)process.env.TELEGRAM_BOT_TOKEN=saved;else delete process.env.TELEGRAM_BOT_TOKEN;}
});
