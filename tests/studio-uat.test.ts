import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { handleApi } from '../src/lib/api';
import { cookieNames } from '../src/lib/http';
import { audit, createLogin, principal, type Tokens } from '../src/lib/security';
import { configureMux, syntheticMux } from './mux-fixtures';
import { fixture } from './helpers';
import { academyCatalog,saveContent } from '../src/lib/content';
import { readCatalogSearch,searchCatalog } from '../src/lib/catalog-search';

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
        "INSERT INTO registration_requests(telegram_id,display_name,phone,order_source,order_number) VALUES($1,'Synthetic applicant','7000000','kaspi','DEV123') RETURNING id",[telegramId]);
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

test('UAT approval never grants an unselected learning track',async()=>{
  const f=await fixture();
  try {
    const call=client(f),tech=await f.account('techadmin');
    const reviewer=await f.account('admin','approved',[],['students.approve']);
    const operator=await f.account('admin','approved',[],['students.approve','students.tracks']);
    const approveRequest=async(telegramId:string)=>{
      const {rows:[row]}=await f.engine.query<{id:string}>(
        "INSERT INTO registration_requests(telegram_id,display_name,phone,order_source,order_number) VALUES($1,'Synthetic Braun customer','7000000','braun','SYN123') RETURNING id",[telegramId]);
      return 'studio/registration/'+row.id;
    };
    const first='900009000000001',second='900009000000002';
    const firstPath=await approveRequest(first);
    assert.equal((await call(firstPath,'POST',reviewer.tokens,{action:'invite',role:'student',tracks:['braun']})).status,403);
    assert.equal((await call(firstPath,'POST',reviewer.tokens,{action:'invite',role:'student'})).status,200);
    assert.equal((await call(await approveRequest(second),'POST',operator.tokens,{action:'invite',role:'student',tracks:['braun']})).status,200);
    const firstLogin=await f.run(db=>createLogin(db,first));
    const secondLogin=await f.run(db=>createLogin(db,second));
    assert.deepEqual((await f.run(db=>principal(db,{session:firstLogin.sessionToken,device:firstLogin.deviceToken}))).scopes,['academy']);
    assert.deepEqual((await f.run(db=>principal(db,{session:secondLogin.sessionToken,device:secondLogin.deviceToken}))).scopes.sort(),['academy','braun']);
    assert.equal((await call('studio/accounts/'+reviewer.id,'POST',reviewer.tokens,{action:'learning',enabled:true})).status,403);
    assert.equal((await call('studio/accounts/'+reviewer.id,'POST',tech.tokens,{action:'delete'})).status,200);
  }finally{await f.close();}
});

test('UAT Studio persists allowed work and rejects operations outside each delegated grant',async()=>{
  const f=await fixture();
  try {
    const call=client(f),tech=await f.account('techadmin'),student=await f.account();
    const editor=await f.account('admin','approved',[],['content.read','content.edit']);
    const delegated=await f.account('admin','approved',[],['content.read','content.edit','recipes.manage','students.read','audit.read']);
    const types=['attachment','collection','material'] as const;
    const draft=(kind:string,slug:string)=>({kind,slug,title:'Synthetic '+kind});
    const newRoute='studio/content';
    for(const kind of types){
      const payload=draft(kind,'unauthorized-'+kind);
      assert.equal((await call(newRoute,'POST',editor.tokens,payload)).status,403,'missing kind grant: '+kind);
      assert.equal((await f.engine.query('SELECT id FROM content WHERE slug=$1',[payload.slug])).rows.length,0);
    }
    for(const kind of ['attachment','collection'] as const){
      const payload=draft(kind,'uat-delegated-'+kind);
      const created=await call(newRoute,'POST',delegated.tokens,payload);
      assert.equal(created.status,200,kind);
      const {id}=await created.json();
      const url=newRoute+'/'+id;
      assert.equal((await call(url,'PATCH',delegated.tokens,{...payload,version:1,title:'Edited '+kind})).status,200);
      assert.equal((await call(url,'PATCH',delegated.tokens,{...payload,version:2,status:'published'})).status,403);
      assert.equal((await call(url,'DELETE',delegated.tokens)).status,403);
      assert.deepEqual((await f.engine.query('SELECT status,version,title FROM content WHERE id=$1',[id])).rows,
        [{status:'draft',version:2,title:'Edited '+kind}]);
      assert.equal((await call(url,'PATCH',tech.tokens,{...payload,version:2,status:'published'})).status,200);
      assert.equal((await call(url,'PATCH',tech.tokens,{...payload,version:3,status:'hidden'})).status,200);
      assert.equal((await call(url,'DELETE',tech.tokens)).status,200);
      assert.equal((await f.engine.query('SELECT id FROM content WHERE id=$1',[id])).rows.length,0);
    }
    assert.equal((await call(newRoute,'POST',delegated.tokens,draft('material','uat-delegated-material'))).status,403);
    assert.equal((await call('studio/accounts/'+student.id,'POST',delegated.tokens,{action:'tracks',tracks:['braun']})).status,403);
    assert.equal((await call('studio/accounts/'+delegated.id,'POST',delegated.tokens,{action:'staff',role:'admin',grants:['students.tracks']})).status,403);
    assert.equal((await call('studio/accounts/'+tech.id,'POST',delegated.tokens,{action:'block'})).status,403);
    assert.equal((await call('studio/devices/'+tech.id,'POST',delegated.tokens,{})).status,403);
    assert.equal((await call('studio/accounts/'+delegated.id,'POST',tech.tokens,{action:'staff',role:'admin',grants:['students.read','students.tracks']})).status,200);
    assert.equal((await call('studio/content','GET',delegated.tokens)).status,401);
    const signedIn=await f.run(db=>createLogin(db,delegated.telegramId,delegated.tokens.device));
    const fresh={session:signedIn.sessionToken,device:signedIn.deviceToken};
    assert.equal((await call('studio/content','GET',fresh)).status,403);
    assert.equal((await call('studio/accounts/'+student.id,'POST',fresh,{action:'tracks',tracks:['braun']})).status,200);
    assert.equal((await call('profile','GET',student.tokens)).status,401);
    assert.deepEqual((await f.engine.query('SELECT scope FROM access_entitlements WHERE user_id=$1 ORDER BY scope',[student.id])).rows,
      [{scope:'academy'},{scope:'braun'}]);
    const audit=await f.engine.query<{operation:string}>("SELECT operation FROM audit_events WHERE actor_id=$1 AND operation IN ('account.staff','content.delete')",[tech.id]);
    assert.ok(audit.rows.some(row=>row.operation==='account.staff'));
    assert.equal(audit.rows.filter(row=>row.operation==='content.delete').length,2);
  }finally{await f.close();}
});

test('UAT learner access matrix keeps each program isolated across content, activity, and media',async t=>{
  const f=await fixture(),restore=configureMux(),originalFetch=globalThis.fetch;
  const oldBot=process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN='999999999:synthetic_uat_download_key';
  try{
    const call=client(f),tech=await f.account('techadmin');
    const tracks=['kenwood','braun','ambassador'] as const;
    const assets=new Map<string,{id:string;upload:string;playback:string}>();
    let callsToMux=0;
    globalThis.fetch=async input=>{
      const target=new URL(String(input));
      assert.equal(target.origin,'https://api.mux.com');
      const id=target.pathname.split('/').at(-1)!;
      const asset=assets.get(id);
      assert.ok(asset);
      callsToMux++;
      return Response.json({data:{id,upload_id:asset.upload,passthrough:asset.id,status:'ready',duration:60,
        video_quality:'basic',resolution_tier:'1080p',max_resolution_tier:'1080p',playback_ids:[{id:asset.playback,policy:'signed'}]}});
    };
    const catalog=await Promise.all(tracks.map(async track=>{
      const prefix='uat-isolation-'+track,secret='synthetic full content '+track,venue='synthetic venue '+track,model='Uat model '+track;
      const media=async(kind:'document'|'video')=>(await f.engine.query<{id:string}>(
        "INSERT INTO media(kind,provider,state,created_by,mime,bytes,provider_id,mux_upload_id,mux_playback_id,duration_seconds) VALUES($1,$2,'ready',$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        kind==='document'?[kind,'postgres',tech.id,'application/pdf',Buffer.from(secret),null,null,null,null]:
          [kind,'mux',tech.id,null,null,'UatAsset'+track,'UatUpload'+track,'UatPlayback'+track,60])).rows[0].id;
      const file=await media('document'),video=await media('video');
      assets.set('UatAsset'+track,{id:video,upload:'UatUpload'+track,playback:'UatPlayback'+track});
      const save=(kind:string,suffix:string,data:Record<string,unknown>={},props:Record<string,unknown>={})=>f.run(db=>saveContent(db,tech.p,{
        kind,slug:prefix+'-'+suffix,title:prefix+' '+suffix,status:'published',data:{...data,body:secret},...props,
      }));
      const audience={tracks:[track],catalogSection:track==='braun'?'kenwood':track};
      const course=await save('course','course',audience);
      const module=await save('module','module',{}, {parentId:course});
      const lesson=await save('lesson','lesson',{}, {parentId:module,mediaIds:[file,video]});
      const material=await save('material','material',audience);
      const attachment=await save('attachment','attachment',{...audience,model});
      const recipe=await save('recipe','recipe',{...audience,ingredients:['Synthetic ingredient'],steps:['Synthetic step'],portions:2,duration:10},
        {links:[attachment]});
      const post=await save('post','offer',{...audience,postKind:'offer'});
      const event=await save('event','event',{...audience,city:'Synthetic city',venueAddress:venue,capacity:20,startsAt:new Date(Date.now()+86400000).toISOString()});
      return {track,lesson,file,video,recipe,event,attachment,ids:[course,module,lesson,material,attachment,recipe,post,event],prefix,secret,venue,model};
    }));
    const viewers: [string,string[]][]=[
      ['none',[]],
      ...tracks.map((track):[string,string[]]=>[track,[track]]),
      ['Kenwood + Braun',['kenwood','braun']],
      ['Kenwood + Ambassador',['kenwood','ambassador']],
      ['Braun + Ambassador',['braun','ambassador']],
      ['all tracks',[...tracks]],
    ];
    for(const [label,allowed] of viewers)await t.test(label,async()=>{
      const user=await f.account('student','approved',['academy',...allowed]);
      const scope=await f.run(db=>academyCatalog(db,user.p));
      const result=await call('content?q=uat-isolation','GET',user.tokens);
      assert.equal(result.status,200);
      const listed=await result.json() as {id:string}[];
      for(const item of catalog){
        const canRead=allowed.includes(item.track);
        for(const id of item.ids){
          const card=scope.catalog.find(node=>node.id===id);
          assert.ok(card,'title card '+id);
          assert.equal(!!card.locked,!canRead,'card entitlement '+item.track);
          assert.equal(listed.some(node=>node.id===id),canRead,'API visibility '+item.track);
          assert.equal(scope.nodes.some(node=>node.id===id),canRead,'detail visibility '+item.track);
          if(!canRead)assert.doesNotMatch(JSON.stringify(card),new RegExp(item.secret+'|'+item.venue+'|'+item.model));
        }
        const searches=searchCatalog(scope.catalog,readCatalogSearch({q:item.model}));
        assert.equal(searches.some(row=>row.id===item.attachment),canRead,'protected model in search');
        assert.equal((await call('progress','POST',user.tokens,{lessonId:item.lesson,position:12,completed:true})).status,canRead?200:404);
        assert.equal((await call('favorites','POST',user.tokens,{contentId:item.recipe,enabled:true})).status,canRead?200:404);
        assert.equal((await call('events/'+item.event+'/register','POST',user.tokens,{})).status,canRead?200:404);
        const download=await call('media/'+item.file+'/download','GET',user.tokens);
        assert.equal(download.status,canRead?200:403);
        if(canRead){
          const signedApi=(await download.json()).url.replace(/^\/api\//,'');
          const content=await call(signedApi,'GET',user.tokens);
          assert.equal(content.status,200);
          assert.equal(await content.text(),item.secret);
          const other=await f.account('student','approved',['academy',item.track]);
          assert.equal((await call(signedApi,'GET',other.tokens)).status,403,'download URL bound to the original session');
        }
        const muxBefore=callsToMux;
        const playback=await call('media/'+item.video+'/playback','GET',user.tokens);
        assert.equal(playback.status,canRead?200:403);
        assert.equal(callsToMux-muxBefore,canRead?1:0,'Mux request only after authorization');
      }
      const profile=await (await call('profile','GET',user.tokens)).json();
      assert.deepEqual(profile.progress.map((x:{lesson_id:string})=>x.lesson_id).sort(),catalog.filter(x=>allowed.includes(x.track)).map(x=>x.lesson).sort());
      assert.deepEqual(profile.favorites.map((x:{content_id:string})=>x.content_id).sort(),catalog.filter(x=>allowed.includes(x.track)).map(x=>x.recipe).sort());
      assert.deepEqual(profile.registrations.map((x:{event_id:string})=>x.event_id).sort(),catalog.filter(x=>allowed.includes(x.track)).map(x=>x.event).sort());
      for(const path of ['studio/content','studio/accounts','studio/media','studio/support','studio/audit']){
        assert.equal((await call(path,'GET',user.tokens)).status,403,path);
      }
    });
    await t.test('changing tracks withdraws sessions and previous private links',async()=>{
      const first=catalog[0],second=catalog[1],user=await f.account();
      const signed=(await (await call('media/'+first.file+'/download','GET',user.tokens)).json()).url.replace(/^\/api\//,'');
      assert.equal((await call('favorites','POST',user.tokens,{contentId:first.recipe,enabled:true})).status,200);
      assert.equal((await call('progress','POST',user.tokens,{lessonId:first.lesson,position:12,completed:true})).status,200);
      assert.equal((await call('studio/accounts/'+user.id,'POST',tech.tokens,{action:'tracks',tracks:['braun']})).status,200);
      assert.equal((await call(signed,'GET',user.tokens)).status,401);
      const current=await f.run(db=>createLogin(db,user.telegramId,user.tokens.device));
      const tokens={session:current.sessionToken,device:current.deviceToken};
      assert.equal((await call(signed,'GET',tokens)).status,403);
      assert.equal((await call('media/'+first.video+'/playback','GET',tokens)).status,403);
      const profile=await (await call('profile','GET',tokens)).json();
      assert.deepEqual(profile.favorites,[]);
      assert.deepEqual(profile.progress,[]);
      assert.equal((await call('progress','POST',tokens,{lessonId:second.lesson,position:12,completed:true})).status,200);
    });
  }finally{
    globalThis.fetch=originalFetch;
    restore();
    if(oldBot===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldBot;
    await f.close();
  }
});
