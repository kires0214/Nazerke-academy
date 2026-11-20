import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers';
import { academyCatalog,contentSchema,filterContent,getContent,listContent,saveContent,setProgress } from '../src/lib/content';
import { migrate } from '../scripts/migrate';
import { readFile } from 'node:fs/promises';
import { starterProgram } from '../src/lib/starter-program';
import { readCatalogSearch,searchCatalog,trackCatalog } from '../src/lib/catalog-search';

test('synthetic content: ten ordered Kenwood lessons, private scope and normalized recipe reuse',async()=>{
  const f=await fixture();try {const a=await f.account(),all=await f.run(db=>listContent(db,a.p));
    const course=all.find(n=>n.slug==='kenwood')!,module=all.find(n=>n.parent_id===course.id)!;
    const lessons=all.filter(n=>n.kind==='lesson'&&n.parent_id===module.id);assert.equal(lessons.length,10);assert.deepEqual(lessons.map(n=>n.sort_order),[0,1,2,3,4,5,6,7,8,9]);
    assert.equal(all.some(n=>n.audience==='ambassador'),false);assert.equal((await f.run(db=>listContent(db))).length,0);
    const pasta=all.find(n=>n.slug==='pasta')!;assert.equal((await f.engine.query('SELECT id FROM content WHERE slug=\'pasta\'')).rows.length,1);
    assert.equal((await f.engine.query('SELECT * FROM content_links WHERE target_id=$1',[pasta.id])).rows.length,3);
    const admin=await f.account('admin','approved',[],['content.read']);assert.equal((await f.run(db=>listContent(db,admin.p))).length,0);
    assert.ok((await f.run(db=>listContent(db,admin.p,true))).length>0);
  }finally{await f.close();}
});
test('CMS draft/edit/publish/hide persists, optimistic conflicts and audit; edits cannot bypass publication grant',async()=>{
  const f=await fixture();try {const editor=await f.account('admin','approved',[],['content.read','content.edit','recipes.manage']),tech=await f.account('techadmin'),student=await f.account();
    const input=contentSchema.parse({kind:'recipe',slug:'synthetic-recipe',title:'Synthetic DEV',data:{duration:10,portions:2,ingredients:['Synthetic flour'],steps:['Synthetic step']}});
    const id=await f.run(db=>saveContent(db,editor.p,input));
    await assert.rejects(f.run(db=>getContent(db,id,student.p)),/CONTENT_NOT_FOUND/);
    await assert.rejects(f.run(db=>saveContent(db,editor.p,{...input,status:'published',version:1},id)),/PERMISSION_DENIED/);
    await f.run(db=>saveContent(db,tech.p,{...input,status:'published',version:1},id));
    assert.equal((await f.run(db=>getContent(db,id,student.p))).title,'Synthetic DEV');
    await assert.rejects(f.run(db=>saveContent(db,editor.p,{...input,title:'Silent live edit',version:2},id)),/PERMISSION_DENIED/);
    await assert.rejects(f.run(db=>saveContent(db,tech.p,{...input,status:'hidden',version:1},id)),/CONTENT_CHANGED_RELOAD/);
    await f.run(db=>saveContent(db,tech.p,{...input,status:'hidden',version:2},id));
    await assert.rejects(f.run(db=>getContent(db,id,student.p)),/CONTENT_NOT_FOUND/);
    assert.equal((await f.engine.query("SELECT id FROM audit_events WHERE entity_id=$1 AND operation LIKE 'content.%'",[id])).rows.length,3);
  }finally{await f.close();}
});
test('CMS rejects invalid parents, public lessons, incomplete recipes/events and raw privilege fields',async()=>{
  const f=await fixture();try {const tech=await f.account('techadmin');
    await assert.rejects(f.run(db=>saveContent(db,tech.p,{kind:'lesson',slug:'bad-lesson',title:'Bad'})),/PARENT_REQUIRED/);
    await assert.rejects(f.run(db=>saveContent(db,tech.p,{kind:'recipe',slug:'public-recipe',title:'Bad',audience:'public'})),/PRIVATE_CONTENT_KIND/);
    await assert.rejects(f.run(db=>saveContent(db,tech.p,{kind:'recipe',slug:'empty-recipe',title:'Bad',status:'published'})),/RECIPE_DETAILS_REQUIRED/);
    await assert.rejects(f.run(db=>saveContent(db,tech.p,{kind:'event',slug:'empty-event',title:'Bad',status:'published'})),/EVENT_DETAILS_REQUIRED/);
    assert.throws(()=>contentSchema.parse({kind:'recipe',slug:'bad',title:'Bad',role:'techadmin'}));
  }finally{await f.close();}
});
test('progress enforces order, stores resume and completion; hiding course hides all descendants',async()=>{
  const f=await fixture();try {const a=await f.account(),all=await f.run(db=>listContent(db,a.p));
    const first=all.find(n=>n.slug==='kenwood-1')!,second=all.find(n=>n.slug==='kenwood-2')!;
    await assert.rejects(f.run(db=>setProgress(db,a.p,second.id,0,true)),/COMPLETE_EARLIER_LESSONS/);
    await f.run(db=>setProgress(db,a.p,first.id,42,false));
    assert.equal((await f.engine.query<{position_seconds:number}>('SELECT position_seconds FROM lesson_progress WHERE user_id=$1',[a.id])).rows[0].position_seconds,42);
    await f.run(db=>setProgress(db,a.p,first.id,55,true));await f.run(db=>setProgress(db,a.p,second.id,0,true));
    await f.engine.query("UPDATE content SET status='hidden' WHERE slug='kenwood'");
    await assert.rejects(f.run(db=>getContent(db,first.id,a.p)),/CONTENT_NOT_FOUND/);
  }finally{await f.close();}
});
test('recipe search, language/category/duration filters and XSS remain text',async()=>{
  const f=await fixture();try {const a=await f.account(),all=await f.run(db=>listContent(db,a.p));
    assert.equal(filterContent(all,new URLSearchParams({kind:'recipe',q:'паста',language:'RU',category:'Горячие блюда',duration:'60'})).length,1);
    assert.equal(filterContent(all,new URLSearchParams({kind:'recipe',duration:'15'})).length,0);
    assert.equal(filterContent(all,new URLSearchParams({q:"' OR 1=1 --"})).length,0);
  }finally{await f.close();}
});
test('section search finds lesson titles through their course and excludes drafts and restricted details',async()=>{
  const f=await fixture();
  try {
    const learner=await f.account(),tech=await f.account('techadmin');
    const save=(kind:string,slug:string,title:string,data:Record<string,unknown>,status='published')=>f.run(db=>saveContent(db,tech.p,{
      kind,slug,title,data,status,
    }));
    const upcoming=await save('post','synthetic-coming-soon','Ёлка · Synthetic',{postKind:'coming-soon',tracks:['braun'],body:'Private synopsis marker'});
    await save('post','synthetic-draft-soon','Ёлка · Draft',{postKind:'coming-soon'},'draft');
    await save('post','synthetic-visible-offer','Ёлка · Offer',{postKind:'offer'});
    const {catalog}=await f.run(db=>academyCatalog(db,learner.p));
    const search=readCatalogSearch({q:'ПЕРВОЕ ВКЛЮЧЕНИЕ',kind:'lesson'},{kinds:true});
    assert.deepEqual(searchCatalog(trackCatalog(catalog,'kenwood','training',true),search).map(node=>node.slug),['kenwood-3']);
    for(const group of ['attachments','recipes'] as const)assert.equal(searchCatalog(trackCatalog(catalog,'kenwood',group,true),search).length,0);
    assert.equal(searchCatalog(trackCatalog(catalog,'braun','all',true),search).length,0);
    const posts=catalog.filter(node=>node.data.postKind==='coming-soon');
    const matches=searchCatalog(posts,readCatalogSearch({q:'елка',language:'RU'}));
    assert.deepEqual(matches.map(node=>node.id),[upcoming]);
    assert.ok(matches[0].locked);
    assert.equal(searchCatalog(posts,readCatalogSearch({q:'Private synopsis marker'})).length,0);
    assert.ok(!trackCatalog(catalog,'kenwood','all',true).some(node=>node.data.postKind==='coming-soon'||node.data.postKind==='offer'));
    assert.equal(searchCatalog(posts,readCatalogSearch({q:'елка',language:'EN'})).length,0);
    await assert.rejects(f.run(db=>getContent(db,upcoming,learner.p)),/CONTENT_NOT_FOUND/);
  }finally{await f.close();}
});
test('starter program tracks only published accessible courses and completes separately for each learner',async()=>{
  const f=await fixture();
  try {
    const learner=await f.account(),other=await f.account(),tech=await f.account('techadmin');
    const braunLearner=await f.account('student','approved',['academy','braun']);
    const save=(kind:string,slug:string,extra:Record<string,unknown>={})=>f.run(db=>saveContent(db,tech.p,{
      kind,slug,title:slug,status:'published',...extra,
    }));
    const intro=await save('course','synthetic-starter',{data:{starter:true}});
    const module=await save('module','synthetic-starter-module',{parentId:intro});
    const lesson=await save('lesson','synthetic-starter-lesson',{parentId:module});
    await save('lesson','synthetic-starter-draft',{parentId:module,status:'draft'});
    const braun=await save('course','synthetic-braun-starter',{data:{starter:true,tracks:['braun']}});
    const braunModule=await save('module','synthetic-braun-starter-module',{parentId:braun});
    await save('lesson','synthetic-braun-starter-lesson',{parentId:braunModule});
    await save('course','synthetic-empty-starter',{data:{starter:true}});
    assert.throws(()=>contentSchema.parse({kind:'recipe',slug:'invalid-starter',title:'Invalid',data:{starter:true}}));
    const content=await f.run(db=>listContent(db,learner.p));
    const program=async (actor:typeof learner)=>starterProgram(await f.run(db=>listContent(db,actor.p)),
      (await f.engine.query<{lesson_id:string;completed_at:string|null}>('SELECT lesson_id,completed_at FROM lesson_progress WHERE user_id=$1',[actor.id])).rows);
    assert.deepEqual((await program(braunLearner)).courses.map(item=>item.course.id),[braun]);
    assert.deepEqual((await program(learner)).courses.map(item=>item.course.slug),['kenwood','synthetic-starter']);
    await assert.rejects(f.run(db=>setProgress(db,braunLearner.p,lesson,0,true)),/CONTENT_NOT_FOUND/);
    const kenwood=content.find(node=>node.slug==='kenwood')!;
    const kenwoodModule=content.find(node=>node.parent_id===kenwood.id)!;
    const lessons=content.filter(node=>node.parent_id===kenwoodModule.id);
    await f.run(db=>setProgress(db,learner.p,lessons[0].id,30,false));
    assert.equal((await program(learner)).remaining?.nextLesson?.id,lessons[0].id);
    for(const item of lessons)await f.run(db=>setProgress(db,learner.p,item.id,0,true));
    assert.equal((await program(learner)).remaining?.nextLesson?.id,lesson);
    await f.run(db=>setProgress(db,learner.p,lesson,0,true));
    const complete=await program(learner);
    assert.equal(complete.finished,2);
    assert.equal(complete.remaining,undefined);
    assert.equal(complete.courses.length,2);
    assert.equal((await program(other)).finished,0);
    assert.equal(starterProgram(content.map(node=>node.id===kenwood.id?{...node,data:{...node.data,starter:false}}:node),[]).courses.length,1);
  }finally{await f.close();}
});
test('migrations are idempotent and checksum locked on a fresh PostgreSQL engine',async()=>{
  const { PGlite }=await import('@electric-sql/pglite'),{adapter}=await import('./helpers');const engine=new PGlite();
  try {await engine.transaction(tx=>migrate(adapter(tx as unknown as typeof engine)));await engine.transaction(tx=>migrate(adapter(tx as unknown as typeof engine)));
    assert.equal((await engine.query('SELECT * FROM schema_migrations')).rows.length,9);
    await engine.query("UPDATE schema_migrations SET sha256='changed'");await assert.rejects(engine.transaction(tx=>migrate(adapter(tx as unknown as typeof engine))),/MIGRATION_CHECKSUM_CHANGED/);
  }finally{await engine.close();}
});
