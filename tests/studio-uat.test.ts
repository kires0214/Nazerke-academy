import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { handleApi } from '../src/lib/api';
import { cookieNames } from '../src/lib/http';
import { audit, type Tokens } from '../src/lib/security';
import { configureMux, syntheticMux } from './mux-fixtures';
import { fixture } from './helpers';
import { academyCatalog,saveContent } from '../src/lib/content';

const origin='https://uat.juicy.invalid';
process.env.APP_BASE_URL=origin;
process.env.APP_ENV='DEV';

function client(f:Awaited<ReturnType<typeof fixture>>) {
  return async (path:string,method='GET',t?:Tokens,body?:unknown,requestOrigin=origin)=>{
    const n=cookieNames();
    return handleApi(new NextRequest(origin+'/api/'+path,{
      method,headers:{Origin:requestOrigin,'Content-Type':'application/json',
        ...(t?{Cookie:`${n.session}=${t.session}; ${n.device}=${t.device}`}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    }),path.split('?')[0].split('/'),f.run);
  };
}

test('role matrix denies restricted actions and verifies ordinary learner/ambassador content boundaries',async()=>{
  const f=await fixture();
  try{
    const call=client(f);
    const tech=await f.account('techadmin'),student=await f.account(),ambassador=await f.account('student','approved',['academy','ambassador']);
    const noGrants=await f.account('admin','approved',[],[]);
    const pending=await f.account('student','pending',[]);
    const blocked=await f.account();
    await f.engine.query("UPDATE users SET status='blocked' WHERE id=$1",[blocked.id]);
    const admin=await f.account('admin','approved',[],['students.read','devices.reset','students.block']);
    await f.engine.query('UPDATE users SET approved_at=now() WHERE id=$1',[student.id]);
    const studioRoutes=['studio/content','studio/accounts','studio/media','studio/support','studio/audit'];
    for(const route of studioRoutes){
      assert.equal((await call(route)).status,401,route+' guest');
      for(const a of [pending,blocked,student,ambassador,noGrants])assert.equal((await call(route,'GET',a.tokens)).status,403,route);
      assert.equal((await call(route,'GET',tech.tokens)).status,200,route+' Tech Admin');
    }
    const nodes=await (await call('content','GET',tech.tokens)).json();
    const privateContent=nodes.find((n:{audience:string})=>n.audience==='ambassador');
    assert.ok(privateContent);
    for(const a of [undefined,student.tokens,admin.tokens]){
      const visible=await (await call('content','GET',a)).json();
      assert.ok(!visible.some((n:{id:string})=>n.id===privateContent.id));
    }
    const ambassadorContent=await (await call('content','GET',ambassador.tokens)).json() as {id:string}[];
    assert.ok(ambassadorContent.some(n=>n.id===privateContent.id));
    assert.equal((await call('studio/devices/'+tech.id,'POST',admin.tokens,{})).status,403);
    assert.equal((await call('studio/accounts/'+admin.id,'POST',admin.tokens,{action:'staff',role:'admin',grants:['audit.read']})).status,403);
    assert.equal((await call('studio/accounts/'+student.id,'POST',noGrants.tokens,{action:'block'})).status,403);
    assert.equal((await call('studio/accounts/'+student.id,'POST',admin.tokens,{action:'block'})).status,200);
    assert.equal((await call('profile','GET',student.tokens)).status,401);
    assert.equal((await call('studio/accounts/'+student.id,'POST',admin.tokens,{action:'unblock'})).status,200);
    assert.equal((await call('profile','GET',student.tokens)).status,401);
    assert.equal((await f.engine.query<{status:string}>('SELECT status FROM users WHERE id=$1',[student.id])).rows[0].status,'approved');
  }finally{await f.close();}
});

test('archive revokes access, restores the original status and limits permanent removal to Tech Admin',async()=>{
  const f=await fixture();
  try{
    const call=client(f),tech=await f.account('techadmin'),learner=await f.account();
    const manager=await f.account('admin','approved',[],['students.read','students.block','devices.reset']);
    const staff=await f.account('admin','approved',[],['students.read']);
    const act=(id:string,action:string,tokens:Tokens)=>call('studio/accounts/'+id,'POST',tokens,{action});
    assert.equal((await act(learner.id,'archive',learner.tokens)).status,403);
    assert.equal((await act(staff.id,'archive',manager.tokens)).status,403);
    assert.equal((await act(tech.id,'delete',tech.tokens)).status,403);
    assert.equal((await act(learner.id,'archive',manager.tokens)).status,200);
    assert.equal((await call('profile','GET',learner.tokens)).status,401);
    const archived=await (await call('studio/accounts?view=archive','GET',manager.tokens)).json();
    assert.ok(archived.some((user:{id:string;status:string})=>user.id===learner.id&&user.status==='archived'));
    const current=await (await call('studio/accounts','GET',manager.tokens)).json();
    assert.ok(!current.some((user:{id:string})=>user.id===learner.id));
    assert.equal((await act(learner.id,'unblock',manager.tokens)).status,409);
    assert.equal((await act(learner.id,'delete',manager.tokens)).status,403);
    assert.equal((await act(learner.id,'restore',manager.tokens)).status,200);
    assert.equal((await act(learner.id,'block',manager.tokens)).status,200);
    assert.equal((await act(learner.id,'archive',manager.tokens)).status,200);
    assert.equal((await act(learner.id,'restore',manager.tokens)).status,200);
    assert.deepEqual((await f.engine.query('SELECT status,archived_from FROM users WHERE id=$1',[learner.id])).rows,
      [{status:'blocked',archived_from:null}]);
    assert.equal((await act(learner.id,'delete',tech.tokens)).status,200);
    assert.equal((await act(learner.id,'delete',tech.tokens)).status,404);
    assert.equal((await f.engine.query('SELECT id FROM devices WHERE user_id=$1',[learner.id])).rows.length,0);
    assert.deepEqual((await f.engine.query('SELECT status,telegram_id,display_name FROM users WHERE id=$1',[learner.id])).rows,
      [{status:'deleted',telegram_id:null,display_name:'Удалённый аккаунт'}]);
    assert.equal((await f.engine.query("SELECT id FROM audit_events WHERE operation='account.delete' AND entity_id=$1",[learner.id])).rows.length,1);
  }finally{await f.close();}
});

test('audit uses the authentic actor, counts repeated allowed views, and scopes admin results',async()=>{
  const f=await fixture();
  try{
    const call=client(f),student=await f.account(),tech=await f.account('techadmin');
    const auditor=await f.account('admin','approved',[],['audit.read']);
    const manager=await f.account('admin','approved',[],['analytics.read']);
    for(let i=0;i<2;i++)assert.equal((await call('activity','POST',student.tokens,{path:'/academy/recipes'})).status,200);
    assert.equal((await call('activity','POST',student.tokens,{path:'/admin/audit'})).status,403);
    assert.equal((await call('activity','POST',student.tokens,{path:'/academy/recipes?token=synthetic'})).status,400);
    assert.equal((await call('activity','POST',student.tokens,{path:'/academy',actorId:auditor.id})).status,400);
    assert.equal((await call('activity','POST',student.tokens,{path:'/academy'},'https://elsewhere.invalid')).status,403);
    assert.equal((await call('activity','POST',manager.tokens,{path:'/admin/audit'})).status,403);
    assert.equal((await call('activity','POST',tech.tokens,{path:'/admin/audit'})).status,200);
    await f.run(db=>audit(db,tech.id,'account.staff',manager.id,{private:'synthetic metadata'}));
    assert.equal((await call('studio/audit','GET',manager.tokens)).status,403);
    assert.equal((await call('studio/audit','GET',student.tokens)).status,403);
    const scoped=await (await call('studio/audit?kind=visits&days=30','GET',auditor.tokens)).json();
    assert.equal(scoped.rows.length,2);
    for(const r of scoped.rows){
      assert.equal(r.entity_id,'/academy/recipes');assert.equal(r.visit_count,2);assert.ok(r.created_at);
      assert.equal(r.actor_role,'student');assert.equal(r.actor_name,'Synthetic DEV');
    }
    const full=await (await call('studio/audit?kind=actions','GET',tech.tokens)).json();
    assert.ok(full.rows.some((r:{operation:string})=>r.operation==='account.staff'));
    assert.ok(!JSON.stringify(full).includes('synthetic metadata'));
  }finally{await f.close();}
});

test('physical deletion requires distinct grants and protects publications, links and student data',async()=>{
  const f=await fixture();
  try{
    const call=client(f),tech=await f.account('techadmin');
    const editor=await f.account('admin','approved',[],['content.read','content.edit','recipes.manage','media.upload']);
    const deleting=await f.account('admin','approved',[],['content.delete','media.delete']);
    const make={kind:'recipe',slug:'synthetic-delete',title:'Synthetic delete',status:'published',
      data:{duration:10,portions:2,ingredients:['Synthetic'],steps:['Synthetic']}};
    const create=await call('studio/content','POST',tech.tokens,make);
    assert.equal(create.status,200);
    const {id}=await create.json();
    const route='studio/content/'+id;
    const {rows:[image]}=await f.engine.query<{id:string}>(`INSERT INTO media(kind,provider,state,created_by) VALUES('image','postgres','ready',$1) RETURNING id`,[tech.id]);
    await f.engine.query('INSERT INTO content_media VALUES($1,$2)',[id,image.id]);
    assert.equal((await call(route,'DELETE',editor.tokens)).status,403);
    assert.equal((await call(route,'DELETE',deleting.tokens)).status,403);
    assert.equal((await call(route,'DELETE',tech.tokens)).status,409);
    assert.equal((await call('studio/media/'+image.id,'DELETE',editor.tokens)).status,403);
    assert.equal((await call('studio/media/'+image.id,'DELETE',deleting.tokens)).status,409);
    assert.equal((await call(route,'PATCH',tech.tokens,{...make,status:'hidden',version:1,mediaIds:[image.id]})).status,200);
    assert.equal((await call(route,'DELETE',tech.tokens,undefined,'https://elsewhere.invalid')).status,403);
    assert.equal((await call(route,'DELETE',tech.tokens)).status,200);
    assert.equal((await call('studio/media/'+image.id,'DELETE',deleting.tokens)).status,200);
    assert.equal((await f.engine.query("SELECT id FROM audit_events WHERE operation IN ('content.delete','media.delete')")).rows.length,2);
    const parent=(await f.engine.query<{id:string}>("UPDATE content SET status='hidden' WHERE slug='kenwood-basics' RETURNING id")).rows[0]??
      (await f.engine.query<{id:string}>("UPDATE content SET status='hidden' WHERE slug='prep' RETURNING id")).rows[0];
    assert.ok(parent);
    assert.equal((await call('studio/content/'+parent.id,'DELETE',tech.tokens)).status,409);
  }finally{await f.close();}
});

test('Mux deletion verifies upload/asset ownership before deleting and a denied admin never contacts Mux',async()=>{
  const restore=configureMux(),f=await fixture(),original=globalThis.fetch;
  const requests:string[]=[];
  try{
    const call=client(f),tech=await f.account('techadmin'),uploader=await f.account('admin','approved',[],['media.upload']);
    const {rows:[m]}=await f.engine.query<{id:string}>(`INSERT INTO media (kind,provider,mux_upload_id,provider_id,state,created_by)
      VALUES('video','mux','SyntheticUpload','SyntheticAsset','processing',$1) RETURNING id`,[tech.id]);
    let own=false;
    globalThis.fetch=async(input,init)=>{
      const path=new URL(String(input)).pathname;
      const method=init?.method??'GET';
      requests.push(method+' '+path);
      assert.ok(String((init?.headers as Record<string,string>).Authorization).startsWith('Basic '));
      if(method==='DELETE')return new Response(null,{status:204});
      if(path.endsWith('/uploads/SyntheticUpload'))return Response.json({data:{id:'SyntheticUpload',status:'asset_created',asset_id:'SyntheticAsset',new_asset_settings:{passthrough:m.id}}});
      return Response.json({data:{id:'SyntheticAsset',upload_id:'SyntheticUpload',passthrough:own?m.id:'someone-else'}});
    };
    const path='studio/media/'+m.id;
    assert.equal((await call(path,'DELETE',uploader.tokens)).status,403);
    assert.equal(requests.length,0);
    assert.equal((await call(path,'DELETE',tech.tokens)).status,409);
    assert.ok(!requests.some(x=>x.startsWith('DELETE')));
    own=true;
    const success=await call(path,'DELETE',tech.tokens);
    assert.equal(success.status,200);
    assert.ok(!JSON.stringify(await success.json()).includes(syntheticMux.MUX_TOKEN_SECRET));
    assert.equal(requests.at(-1),'DELETE /video/v1/assets/SyntheticAsset');
    assert.equal((await f.engine.query('SELECT id FROM media WHERE id=$1',[m.id])).rows.length,0);
  }finally{globalThis.fetch=original;restore();await f.close();}
});

test('saved Studio preview serves only media attached to the requested material and requires content read',async()=>{
  const f=await fixture();
  try{
    const call=client(f),tech=await f.account('techadmin'),student=await f.account();
    const reader=await f.account('admin','approved',[],['content.read']);
    const uploader=await f.account('admin','approved',[],['media.upload']);
    const bytes=Buffer.from('synthetic preview bytes');
    const {rows:[image]}=await f.engine.query<{id:string}>(
      "INSERT INTO media(kind,provider,state,created_by,mime,bytes) VALUES('image','postgres','ready',$1,'image/png',$2) RETURNING id",
      [tech.id,bytes]);
    const create=async (slug:string,mediaIds:string[])=>{
      const response=await call('studio/content','POST',tech.tokens,{kind:'material',slug,title:slug,mediaIds});
      assert.equal(response.status,200);
      return (await response.json()).id as string;
    };
    const linked=await create('synthetic-preview-linked',[image.id]);
    const unrelated=await create('synthetic-preview-unrelated',[]);
    const path='studio/content/'+linked+'/media/'+image.id+'/file';
    assert.equal((await call(path)).status,401);
    for(const actor of [student,uploader])assert.equal((await call(path,'GET',actor.tokens)).status,403);
    assert.equal((await call('media/'+image.id+'/file','GET',student.tokens)).status,403);
    assert.equal((await call('studio/content/'+unrelated+'/media/'+image.id+'/file','GET',reader.tokens)).status,404);
    const allowed=await call(path,'GET',reader.tokens);
    assert.equal(allowed.status,200);
    assert.equal(allowed.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(Buffer.from(await allowed.arrayBuffer()),bytes);
  }finally{await f.close();}
});

test('invitation role and grants are assigned atomically and only by qualified staff',async()=>{
  const f=await fixture();
  try{
    const call=client(f),tech=await f.account('techadmin');
    const approver=await f.account('admin','approved',[],['students.approve']);
    const coordinator=await f.account('admin','approved',[],['students.approve','students.tracks']);
    const request=async (telegramId:number)=>{
      const {rows:[row]}=await f.engine.query<{id:string}>(
        "INSERT INTO registration_requests(telegram_id,display_name,phone) VALUES($1,'Synthetic invite','7000000') RETURNING id",[telegramId]);
      return 'studio/registration/'+row.id;
    };
    const ambassador=await request(12000001),admin=await request(12000002);
    const invite=(path:string,t:Tokens,role:string,grants:string[]=[],tracks?:string[])=>call(path,'POST',t,{action:'invite',role,grants,tracks});
    assert.equal((await invite(ambassador,approver.tokens,'student',[],['ambassador'])).status,403);
    assert.equal((await invite(admin,coordinator.tokens,'admin',['content.read'])).status,403);
    assert.equal((await invite(admin,tech.tokens,'techadmin')).status,400);
    assert.equal((await invite(ambassador,tech.tokens,'student',['audit.read'],['ambassador'])).status,400);
    assert.equal((await f.engine.query('SELECT id FROM users WHERE telegram_id IN (12000001,12000002)')).rows.length,0);

    assert.equal((await invite(ambassador,coordinator.tokens,'student',[],['ambassador','braun'])).status,200);
    assert.equal((await invite(admin,tech.tokens,'admin',['content.read','media.upload'])).status,200);
    const {rows}=await f.engine.query<{id:string;role:string;status:string}>(
      'SELECT id,role,status FROM users WHERE telegram_id IN (12000001,12000002) ORDER BY telegram_id');
    assert.deepEqual(rows.map(({role,status})=>[role,status]),[['student','approved'],['admin','approved']]);
    assert.deepEqual((await f.engine.query('SELECT scope FROM access_entitlements WHERE user_id=$1 ORDER BY scope',[rows[0].id])).rows,
      [{scope:'academy'},{scope:'ambassador'},{scope:'braun'}]);
    assert.deepEqual((await f.engine.query('SELECT permission FROM admin_grants WHERE user_id=$1 ORDER BY permission',[rows[1].id])).rows,
      [{permission:'content.read'},{permission:'media.upload'}]);
    assert.deepEqual((await f.engine.query("SELECT status,phone FROM registration_requests WHERE telegram_id IN (12000001,12000002)")).rows,
      [{status:'invited',phone:null},{status:'invited',phone:null}]);
  }finally{await f.close();}
});

test('catalog cards remain visible while track grants protect detail, attachments and enrollment',async()=>{
  const f=await fixture();
  try{
    const call=client(f);
    const tech=await f.account('techadmin'),kenwood=await f.account();
    const braun=await f.account('student','approved',['academy','braun']);
    const empty=await f.account('student','approved',['academy']);
    const {rows:[file]}=await f.engine.query<{id:string}>(
      "INSERT INTO media(kind,provider,state,created_by,mime,bytes) VALUES('image','postgres','ready',$1,'image/png',$2) RETURNING id",
      [tech.id,Buffer.from('synthetic restricted file')]);
    const save=(input:Record<string,unknown>)=>f.run(db=>saveContent(db,tech.p,{status:'published',language:'EN',...input}));
    const course=await save({kind:'course',slug:'synthetic-braun-course',title:'Synthetic Braun course',data:{equipmentBrand:'Braun'}});
    const module=await save({kind:'module',slug:'synthetic-braun-module',title:'Synthetic Braun module',parentId:course});
    const lesson=await save({kind:'lesson',slug:'synthetic-braun-lesson',title:'Synthetic Braun lesson',parentId:module,
      description:'Private summary',data:{body:'Private instructions'},mediaIds:[file.id]});
    const event=await save({kind:'event',slug:'synthetic-track-meeting',title:'Synthetic Braun event',
      data:{tracks:['braun'],city:'Synthetic city',venueAddress:'Private venue',startsAt:new Date(Date.now()+86400000).toISOString(),capacity:2}});
    const summary=await f.run(db=>academyCatalog(db,kenwood.p));
    for(const id of [course,module,lesson,event]){
      const card=summary.catalog.find(item=>item.id===id);
      assert.ok(card?.locked);
      assert.equal(card.description,'');
      assert.equal(card.data.body,'');
      assert.equal(card.data.venueAddress,undefined);
      assert.ok(!summary.nodes.some(item=>item.id===id));
    }
    assert.equal((await f.run(db=>academyCatalog(db,empty.p))).catalog.find(item=>item.id===lesson)?.locked,true);
    assert.equal((await f.run(db=>academyCatalog(db,braun.p))).nodes.find(item=>item.id===lesson)?.data.body,'Private instructions');
    assert.equal((await call('media/'+file.id+'/file','GET',kenwood.tokens)).status,403);
    assert.equal((await call('media/'+file.id+'/file','GET',braun.tokens)).status,200);
    const register='events/'+event+'/register';
    assert.equal((await call(register,'POST',kenwood.tokens,{})).status,404);
    assert.equal((await call(register,'POST',braun.tokens,{})).status,200);
    assert.equal((await call('studio/accounts/'+kenwood.id,'POST',tech.tokens,{action:'tracks',tracks:['kenwood','braun']})).status,200);
    assert.equal((await call('profile','GET',kenwood.tokens)).status,401);
    const permissions=await f.engine.query('SELECT scope FROM access_entitlements WHERE user_id=$1 ORDER BY scope',[kenwood.id]);
    assert.deepEqual(permissions.rows,[{scope:'academy'},{scope:'braun'},{scope:'kenwood'}]);
    await f.engine.query("UPDATE content SET language='KZ' WHERE id=$1",[course]);
    assert.ok(!(await f.run(db=>academyCatalog(db,braun.p))).catalog.some(item=>item.id===lesson));
  }finally{await f.close();}
});

test('catalog placement is independent of multi-track access and offer teasers hide their contents',async()=>{
  const f=await fixture();
  try{
    const call=client(f),tech=await f.account('techadmin'),kenwood=await f.account();
    const braun=await f.account('student','approved',['academy','braun']);
    const school=await f.account('student','approved',['academy','ambassador']);
    const body='Synthetic private offer detail';
    const offer=await f.run(db=>saveContent(db,tech.p,{
      kind:'post',title:'Synthetic offer',slug:'synthetic-catalog-offer',audience:'ambassador',status:'published',
      data:{catalogSection:'kenwood',catalogGroup:'recipes',tracks:['braun','ambassador'],postKind:'offer',body},
    }));
    const card=(await f.run(db=>academyCatalog(db,kenwood.p))).catalog.find(node=>node.id===offer);
    assert.ok(card?.locked);
    assert.equal(card.data.catalogSection,'kenwood');
    assert.equal(card.data.catalogGroup,'recipes');
    assert.equal(card.data.postKind,'offer');
    assert.equal(card.data.body,'');
    for(const actor of [braun,school]){
      const result=await (await call('content','GET',actor.tokens)).json();
      assert.equal(result.find((node:{id:string})=>node.id===offer)?.data.body,body);
    }
    for(const tokens of [undefined,kenwood.tokens]){
      const result=await (await call('content','GET',tokens)).json();
      assert.ok(!result.some((node:{id:string})=>node.id===offer));
    }
  }finally{await f.close();}
});

test('built-in article favorites require approval and stay private to one account',async()=>{
  const f=await fixture();
  try{
    const call=client(f),first=await f.account(),second=await f.account(),pending=await f.account('student','pending',[]);
    const route='favorites/article',body={article:'kenwood',enabled:true};
    assert.equal((await call(route,'POST',undefined,body)).status,401);
    assert.equal((await call(route,'POST',pending.tokens,body)).status,403);
    assert.equal((await call(route,'POST',first.tokens,{...body,article:'unknown'})).status,400);
    assert.equal((await call(route,'POST',first.tokens,{...body,userId:second.id})).status,400);
    for(let i=0;i<2;i++)assert.equal((await call(route,'POST',first.tokens,body)).status,200);
    assert.equal((await call(route,'POST',second.tokens,{...body,enabled:false})).status,200);
    assert.deepEqual((await f.engine.query('SELECT user_id,article_key FROM builtin_article_favorites')).rows,
      [{user_id:first.id,article_key:'kenwood'}]);
    assert.equal((await call(route,'POST',first.tokens,{...body,enabled:false})).status,200);
    assert.deepEqual((await f.engine.query('SELECT user_id FROM builtin_article_favorites')).rows,[]);
  }finally{await f.close();}
});
