'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Content,ContentInput } from '@/lib/content';
import { assetNames,kinds } from '@/lib/catalog';
import { apiCall,messageFor } from './actions';

const labels:Record<string,string>={section:'Раздел',course:'Курс',module:'Модуль',lesson:'Урок',attachment:'Насадка',recipe:'Рецепт',collection:'Подборка',post:'Статья / новость / FAQ',material:'Материал',event:'Мастер-класс'};
export function CmsEditor({node,nodes,media,links=[],mediaIds=[]}:{node?:Content;nodes:Content[];media:{id:string;kind:string;state:string}[];links?:string[];mediaIds?:string[]}) {
  const [kind,setKind]=useState(node?.kind??'recipe'),[status,setStatus]=useState(''),[pending,setPending]=useState(false);const router=useRouter();
  const data=node?.data;const field=(name:string,label:string,rows=3)=><label key={name}>{label}<textarea name={name} rows={rows} defaultValue={String(data?.[name as keyof typeof data]??'')}/></label>;
  const listField=(name:'ingredients'|'steps'|'shoppingList'|'prepPlan',label:string)=><label key={name}>{label} · по одной строке<textarea name={name} rows={4} defaultValue={data?.[name]?.join('\n')??''}/></label>;
  return <form className="form-stack" onSubmit={async e=>{
    e.preventDefault();setPending(true);setStatus('');const form=new FormData(e.currentTarget),v=(k:string)=>String(form.get(k)??''),lines=(k:string)=>v(k).split('\n').map(s=>s.trim()).filter(Boolean);
    const payload:ContentInput={kind:kind as ContentInput['kind'],slug:v('slug'),title:v('title'),description:v('description'),language:v('language') as 'RU'|'KZ',audience:v('audience') as ContentInput['audience'],status:v('status') as ContentInput['status'],parentId:v('parentId')||null,sortOrder:Number(v('sortOrder')),cover:v('cover')||null,
      links:form.getAll('links').map(String),mediaIds:form.getAll('mediaIds').map(String),version:node?.version,
      data:{body:v('body'),ingredients:lines('ingredients'),steps:lines('steps'),settings:v('settings'),category:v('category'),model:v('model'),assembly:v('assembly'),usage:v('usage'),care:v('care'),mistakes:v('mistakes'),shoppingList:lines('shoppingList'),prepPlan:lines('prepPlan'),
        ...(v('duration')?{duration:Number(v('duration'))}:{}),...(v('portions')?{portions:Number(v('portions'))}:{}),...(v('postKind')?{postKind:v('postKind') as 'article'}:{}),...(v('city')?{city:v('city')}:{}),...(v('startsAt')?{startsAt:new Date(v('startsAt')+'Z').toISOString()}:{}),...(v('capacity')?{capacity:Number(v('capacity'))}:{})}};
    try {const result=await apiCall('/api/studio/content'+(node?'/'+node.id:''),payload,node?'PATCH':'POST');setStatus('Материал сохранён.');router.push('/admin/edit/'+result.id);router.refresh();}catch(error){setStatus((error as Error).message);}finally{setPending(false);}
  }}>
    <div className="form-grid"><label>Тип материала<select value={kind} disabled={!!node} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label><label>Язык<select name="language" defaultValue={node?.language??'RU'}><option>RU</option><option>KZ</option></select></label></div>
    <label>Название<input name="title" defaultValue={node?.title} required maxLength={200}/></label><label>Адрес · латиницей<input name="slug" defaultValue={node?.slug} required pattern="[a-z0-9][a-z0-9-]{0,99}" maxLength={100}/></label><label>Краткое описание<textarea name="description" defaultValue={node?.description} maxLength={2000}/></label>
    <div className="form-grid"><label>Доступ<select name="audience" defaultValue={node?.audience??'academy'}><option value="academy">Академия</option><option value="ambassador">Амбассадоры</option><option value="public">Публичный</option></select></label><label>Состояние<select name="status" defaultValue={node?.status??'draft'}><option value="draft">Черновик</option><option value="published">Опубликовать</option><option value="hidden">Скрыть</option><option value="archived">Архивировать</option></select></label><label>Порядок<input name="sortOrder" type="number" min={0} defaultValue={node?.sort_order??0}/></label></div>
    {['module','lesson'].includes(kind)?<label>{kind==='module'?'Курс':'Модуль'}<select name="parentId" defaultValue={node?.parent_id??''} required><option value="">Выберите</option>{nodes.filter(n=>n.kind===(kind==='module'?'course':'module')).map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>:null}
    <label>Обложка<select name="cover" defaultValue={node?.cover??''}><option value="">Из загруженных медиа / без обложки</option>{assetNames.map(n=><option key={n} value={n+'.webp'}>{n}</option>)}</select></label>
    {field('body','Текст · абзацы и заголовки ##',8)}
    {kind==='recipe'?<><div className="form-grid"><label>Категория<input name="category" defaultValue={data?.category}/></label><label>Минуты<input name="duration" type="number" min={1} max={2880} defaultValue={data?.duration} required/></label><label>Порции<input name="portions" type="number" min={1} max={100} defaultValue={data?.portions} required/></label></div>{listField('ingredients','Ингредиенты')}{listField('steps','Шаги приготовления')}{field('settings','Параметры Kenwood')}</>:null}
    {kind==='attachment'?<><label>Модель<input name="model" defaultValue={data?.model}/></label>{field('assembly','Сборка')}{field('usage','Применение')}{field('care','Уход')}{field('mistakes','Типичные ошибки')}</>:null}
    {kind==='collection'?<>{listField('shoppingList','Общий список покупок')}{listField('prepPlan','План подготовки')}</>:null}
    {kind==='post'?<label>Рубрика<select name="postKind" defaultValue={data?.postKind??'article'}><option value="article">Статья</option><option value="news">Новости</option><option value="offer">Предложение</option><option value="faq">FAQ</option></select></label>:null}
    {kind==='event'?<><label>Город<input name="city" defaultValue={data?.city}/></label><label>Дата и время · UTC<input name="startsAt" type="datetime-local" defaultValue={data?.startsAt?.slice(0,16)}/></label><label>Мест<input name="capacity" type="number" min={1} max={1000} defaultValue={data?.capacity}/></label></>:null}
    {['recipe','attachment','collection','lesson','course'].includes(kind)?<label>{kind==='recipe'?'Нужные насадки':'Связанные рецепты'}<select name="links" multiple defaultValue={links}>{nodes.filter(n=>n.kind===(kind==='recipe'?'attachment':'recipe')).map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select><small>Можно выбрать несколько материалов. Рецепт хранится в одном экземпляре.</small></label>:null}
    <label>Видео, изображения и PDF<select name="mediaIds" multiple defaultValue={mediaIds}>{media.map(m=><option key={m.id} value={m.id}>{m.kind} · {m.state} · {m.id.slice(0,8)}</option>)}</select></label>
    <button className="btn btn-dark" disabled={pending}>{pending?'Сохраняем…':'Сохранить'}</button><p role="status">{status}</p>
  </form>;
}
export function MediaUpload() {
  const [status,setStatus]=useState(''),[pending,setPending]=useState(false);const router=useRouter();
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();const file=new FormData(e.currentTarget).get('file');if(!(file instanceof File))return;setPending(true);try {
    if(file.type.startsWith('video/')) {
      if(file.size>200*1024*1024)throw new Error('Для пилота выберите видео до 200 МБ.');
      const media=await apiCall('/api/studio/media/stream',{});const data=new FormData();data.append('file',file);const response=await fetch(media.uploadUrl,{method:'POST',body:data});if(!response.ok)throw new Error('Не удалось загрузить видео.');setStatus('Видео загружено и обрабатывается. Нажмите «Обновить» в списке.');
    } else {
      const response=await fetch('/api/studio/media/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw new Error(messageFor(result.error));setStatus('Медиа загружено. Теперь его можно добавить в материал.');
    }router.refresh();
  }catch(error){setStatus((error as Error).message);}finally{setPending(false);}}}><label>Изображение / PDF до 4 МБ, видео до 200 МБ<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/*" required/></label><button className="btn btn-dark" disabled={pending}>{pending?'Загружаем…':'Загрузить'}</button><p role="status">{status}</p></form>;
}
