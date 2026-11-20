import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveContent } from '../src/lib/content';
import { deliverClaimed,dispatchOutbox } from '../src/lib/support';
import { fixture } from './helpers';

test('Telegram content notices describe additions and updates only for subscribed eligible users',async()=>{
  const f=await fixture();
  try {
    const tech=await f.account('techadmin');
    const student=await f.account();
    const ambassador=await f.account('ambassador','approved',['academy','ambassador']);
    const blocked=await f.account();
    const noAccess=await f.account('student','approved',[]);
    await f.account(); // opted out
    await f.engine.query('UPDATE users SET telegram_opt_in=true WHERE id=ANY($1::uuid[])',[[student.id,ambassador.id,blocked.id,noAccess.id]]);
    await f.engine.query("UPDATE users SET status='blocked' WHERE id=$1",[blocked.id]);
    const notices=()=>f.engine.query<{chat_id:string|number;body:string}>('SELECT chat_id,body FROM notification_outbox ORDER BY created_at,chat_id');
    const input={kind:'recipe',slug:'notice-recipe',title:'Синтетический рецепт',
      data:{duration:15,portions:2,ingredients:['Первый ингредиент'],steps:['Первый шаг']}};
    const id=await f.run(db=>saveContent(db,tech.p,input));
    assert.equal((await notices()).rows.length,0);
    await f.run(db=>saveContent(db,tech.p,{...input,status:'published',version:1},id));
    await f.run(db=>saveContent(db,tech.p,{...input,status:'published',version:2,sortOrder:10},id));
    let rows=(await notices()).rows;
    assert.equal(rows.length,2);
    assert.deepEqual(rows.map(row=>String(row.chat_id)),[student.telegramId,ambassador.telegramId]);
    for(const row of rows)assert.equal(row.body,'Новое в JUICY\nРаздел: Рецепты\nРецепт: Синтетический рецепт');
    const updated={...input,data:{...input.data,steps:['Обновлённый шаг']}};
    await f.run(db=>saveContent(db,tech.p,{...updated,status:'published',version:3},id));
    await f.run(db=>saveContent(db,tech.p,{...updated,status:'hidden',version:4},id));
    rows=(await notices()).rows;
    assert.equal(rows.length,4);
    for(const row of rows.slice(2))assert.equal(row.body,'Обновление в JUICY\nРаздел: Рецепты\nРецепт: Синтетический рецепт\nИзменилось: содержание.');

    await f.run(db=>saveContent(db,tech.p,{kind:'course',slug:'private-notice',title:'Синтетический курс',
      audience:'ambassador',status:'published'}));
    rows=(await notices()).rows;
    assert.equal(rows.length,5);
    assert.equal(String(rows.at(-1)!.chat_id),ambassador.telegramId);
    assert.match(rows.at(-1)!.body,/Раздел: Обучение\nКурс: Синтетический курс/);
    const delivered:string[]=[];
    const send=async(chat:string,body:string)=>{delivered.push(chat+' '+body);return String(delivered.length);};
    for(let i=0;i<2;i++){
      const claimed=await f.run(dispatchOutbox);
      await f.run(db=>deliverClaimed(db,claimed,send));
    }
    assert.equal(delivered.length,5);
    assert.equal((await f.run(dispatchOutbox)).length,0);
  }finally{await f.close();}
});
