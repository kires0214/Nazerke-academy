import { isDeepStrictEqual } from 'node:util';
import type { Content,ContentInput } from './content';
import type { Db } from './db';
import { contentTracks,groupFor,sectionFor,trackLabels } from './catalog';
import { isStarterCourse } from './starter-program';

const topics:Record<ContentInput['kind'],[section:string,material:string]>={
  course:['Обучение','Курс'],module:['Обучение','Модуль'],lesson:['Обучение','Урок'],
  attachment:['Обучение','Насадка'],recipe:['Рецепты','Рецепт'],collection:['Рецепты','Подборка'],
  event:['Мастер-классы','Мастер-класс'],material:['Материалы','Материал'],section:['Материалы','Раздел'],
  post:['Новости','Публикация'],
};

function topic(input:ContentInput):[string,string] {
  if(input.kind!=='post')return topics[input.kind];
  if(input.data.postKind==='faq')return ['JUICY Club','Ответ на вопрос'];
  if(input.data.postKind==='offer')return ['Акции','Акция'];
  if(input.data.postKind==='coming-soon')return ['Coming Soon','Анонс'];
  if(input.data.postKind==='news')return ['Новости','Новость'];
  return input.audience==='public'?['Статьи','Статья']:['Новости','Статья'];
}

export async function changesToPublishedContent(db:Db,input:ContentInput,previous:Content) {
  const changes:string[]=[];
  const fields=[
    [input.title,previous.title,'название'],[input.description,previous.description,'описание'],
    [input.cover,previous.cover,'обложка'],[input.language,previous.language,'язык'],
    [input.slug,previous.slug,'адрес'],[input.audience,previous.audience,'доступ'],
    [input.parentId,previous.parent_id,'раздел программы'],
  ];
  for(const [next,before,label] of fields)if(next!==before&&label)changes.push(label);
  const schedule=['startsAt','city','venueAddress','capacity'] as const;
  if(schedule.some(field=>input.data[field]!==previous.data[field]))changes.push('детали встречи');
  if(sectionFor(input.audience,input.data)!==sectionFor(previous.audience,previous.data)||
    groupFor(input.kind,input.data)!==groupFor(previous.kind,previous.data))changes.push('раздел');
  if(!input.parentId&&input.audience!=='public'&&!isDeepStrictEqual([...contentTracks(input.audience,input.data)].sort(),
    [...contentTracks(previous.audience,previous.data)].sort())&&!changes.includes('доступ'))changes.push('доступ');
  if(isStarterCourse(input)!==isStarterCourse(previous))changes.push('стартовая программа');
  const {startsAt,city,venueAddress,capacity,tracks,equipmentBrand,catalogSection,catalogGroup,starter,...nextData}=input.data;
  const {startsAt:oldTime,city:oldCity,venueAddress:oldAddress,capacity:oldCapacity,tracks:oldTracks,equipmentBrand:oldBrand,catalogSection:oldSection,catalogGroup:oldGroup,starter:oldStarter,...oldData}=previous.data;
  if(!isDeepStrictEqual(nextData,oldData))changes.push('содержание');
  const links=(await db.query<{id:string}>('SELECT target_id AS id FROM content_links WHERE source_id=$1 ORDER BY sort_order',[previous.id])).rows;
  if(!isDeepStrictEqual(input.links,links.map(link=>link.id)))changes.push('связанные материалы');
  const media=(await db.query<{id:string}>('SELECT media_id AS id FROM content_media WHERE content_id=$1 ORDER BY media_id',[previous.id])).rows;
  if(!isDeepStrictEqual([...input.mediaIds].sort(),media.map(file=>file.id)))changes.push('видео и файлы');
  if(previous.status!=='published')changes.push('материал снова доступен');
  return changes;
}

export async function queueContentNotice(db:Db,contentId:string,input:ContentInput,changes:string[]|null) {
  if(changes?.length===0)return;
  const {rows:chain}=await db.query<Pick<Content,'data'|'parent_id'|'audience'|'language'|'status'>>(`WITH RECURSIVE chain AS (
    SELECT id,parent_id,status,language,audience,data FROM content WHERE id=$1
    UNION SELECT p.id,p.parent_id,p.status,p.language,p.audience,p.data FROM content p JOIN chain c ON p.id=c.parent_id
  ) SELECT * FROM chain`,[contentId]);
  const root=chain.find(node=>!node.parent_id);
  if(!root||chain.some(node=>node.status!=='published'||node.language==='KZ'))return;
  const scopes=contentTracks(root.audience,root.data);
  const publicNotice=chain.every(node=>node.audience==='public');
  const [category,label]=topic(input);
  const section=category==='Обучение'?trackLabels[sectionFor(root.audience,root.data)]:category;
  const title=input.title.replace(/\s+/g,' ').trim();
  const body=[changes?'Обновление в JUICY':'Новое в JUICY',`Раздел: ${section}`,`${label}: ${title}`];
  if(changes)body.push('Изменилось: '+changes.join(', ')+'.');
  await db.query(`INSERT INTO notification_outbox(chat_id,body)
  SELECT u.telegram_id,$1 FROM users u WHERE u.status='approved' AND u.telegram_opt_in
    AND (u.role='techadmin' OR $2 OR (
      EXISTS (SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope='academy')
      AND EXISTS (SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope=ANY($3::text[]))
    ))`,[body.join('\n'),publicNotice,scopes]);
}
