import { isDeepStrictEqual } from 'node:util';
import type { Content,ContentInput } from './content';
import type { Db } from './db';

const topics:Record<ContentInput['kind'],[section:string,material:string]>={
  course:['Обучение','Курс'],module:['Обучение','Модуль'],lesson:['Обучение','Урок'],
  attachment:['Обучение','Насадка'],recipe:['Рецепты','Рецепт'],collection:['Рецепты','Подборка'],
  event:['Мастер-классы','Мастер-класс'],material:['Материалы','Материал'],section:['Материалы','Раздел'],
  post:['Новости','Публикация'],
};

function topic(input:ContentInput):[string,string] {
  if(input.kind!=='post')return topics[input.kind];
  if(input.data.postKind==='faq')return ['JUICY Club','Ответ на вопрос'];
  if(input.data.postKind==='offer')return ['JUICY Club','Предложение'];
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
  const {startsAt,city,venueAddress,capacity,...nextData}=input.data;
  const {startsAt:oldTime,city:oldCity,venueAddress:oldAddress,capacity:oldCapacity,...oldData}=previous.data;
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
  const [section,label]=topic(input);
  const title=input.title.replace(/\s+/g,' ').trim();
  const body=[changes?'Обновление в JUICY':'Новое в JUICY',`Раздел: ${section}`,`${label}: ${title}`];
  if(changes)body.push('Изменилось: '+changes.join(', ')+'.');
  await db.query(`WITH RECURSIVE chain AS (
    SELECT id,parent_id,status FROM content WHERE id=$3
    UNION SELECT p.id,p.parent_id,p.status FROM content p JOIN chain c ON p.id=c.parent_id
  )
  INSERT INTO notification_outbox(chat_id,body)
  SELECT u.telegram_id,$1 FROM users u WHERE u.status='approved' AND u.telegram_opt_in
    AND NOT EXISTS (SELECT 1 FROM chain WHERE status<>'published')
    AND ($2='public' OR u.role='techadmin' OR EXISTS (
      SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope='academy'
    ) AND ($2='academy' OR u.role='ambassador' AND EXISTS (
      SELECT 1 FROM access_entitlements e WHERE e.user_id=u.id AND e.scope='ambassador'
    )))`,[body.join('\n'),input.audience,contentId]);
}
