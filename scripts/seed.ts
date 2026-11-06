import type { Db } from '../src/lib/db';
import { withDb } from '../src/lib/db';
import { check } from '../src/lib/errors';
import { bodySchema } from '../src/lib/content';
export async function seedDev(db:Db) {
  const body=bodySchema.parse({body:'Синтетический материал DEV. Не является закрытым авторским уроком.'});
  async function add(kind:string,slug:string,title:string,sort=0,parent:string|null=null,cover:string|null=null,audience='academy',data:unknown=body) {
    return (await db.query<{id:string}>(`INSERT INTO content(kind,slug,title,description,status,sort_order,parent_id,cover,audience,data,published_at)
      VALUES($1,$2,$3,'Синтетический материал DEV','published',$4,$5,$6,$7,$8,now()) ON CONFLICT(slug) DO UPDATE SET slug=excluded.slug RETURNING id`,[kind,slug,title,sort,parent,cover,audience,JSON.stringify(data)])).rows[0].id;
  }
  const kenwood=await add('course','kenwood','Kenwood с нуля',0,null,'mixer.webp');
  const module=await add('module','kenwood-basics','Первые шаги с Kenwood',0,kenwood);
  for(const [i,title] of ['Знакомство с Cooking Chef','Базовая комплектация','Первое включение','Экран и настройки','Весы, температура и таймер','Базовые насадки','Встроенные рецепты','Первая готовка','Уход и очистка','Вопросы новичков'].entries()) await add('lesson','kenwood-'+(i+1),title,i,module);
  const attachments:Record<string,string>={};
  for(const [slug,title,model] of [['processor','Кухонный комбайн','Food Processor'],['dicer','Кубикорезка','KAX400PL'],['roller','Тестораскатка','KAX980ME'],['cutter','Лапшерезка','KAX982ME'],['mincer','Мясорубка','KAX950ME'],['juicer','Шнековая соковыжималка','KAX720PL'],['blender','Блендер','Glass Blender'],['hook','Крюк','Dough hook'],['whisk','Венчик','Whisk']]) attachments[slug]=await add('attachment',slug,title,0,null,slug+'.webp','academy',bodySchema.parse({...body,model,usage:'Синтетическое описание. Следуйте инструкции вашей модели.'}));
  const pasta=await add('recipe','pasta','Домашняя паста · DEV',0,null,'pasta.webp','academy',bodySchema.parse({...body,category:'Горячие блюда',duration:45,portions:3,ingredients:['Мука — 300 г','Яйца — 3 шт.','Соль — щепотка'],steps:['Замесить тесто.','Дать тесту отдохнуть.','Раскатать и нарезать.']}));
  const collection=await add('collection','italy','День Италии · DEV',0,null,'pasta.webp','academy',bodySchema.parse({...body,shoppingList:['Мука','Яйца'],prepPlan:['Подготовить тесто заранее']}));
  const lesson=(await db.query<{id:string}>("SELECT id FROM content WHERE slug='kenwood-8'")).rows[0].id;
  for(const [source,target] of [[pasta,attachments.roller],[collection,pasta],[lesson,pasta],[attachments.roller,pasta]])await db.query('INSERT INTO content_links(source_id,target_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[source,target]);
  for(const [slug,title,cover] of [['prep','Заготовки и полуфабрикаты','manti'],['confectioner','Кондитер с нуля','biscuit'],['desserts','Десерты с нуля','tiramisu'],['baking','Тесто, хлеб и выпечка','bread']]) {
    const course=await add('course',slug,title,10,null,cover+'.webp');
    const mod=await add('module',slug+'-module','Введение · DEV',0,course);
    await add('lesson',slug+'-intro','Первые шаги · DEV',0,mod);
  }
  const ambassador=await add('course','ambassador','Школа амбассадоров JUICY',20,null,null,'ambassador');
  const am=await add('module','ambassador-module','Введение',0,ambassador,null,'ambassador');
  await add('lesson','ambassador-intro','Путь амбассадора · DEV',0,am,null,'ambassador');
}
if(process.argv[1]?.endsWith('seed.ts')) {check(process.env.APP_ENV==='DEV',403,'SYNTHETIC_SEED_DEV_ONLY');await withDb(seedDev);console.log('PASS: synthetic DEV content seeded; no accounts created');}
