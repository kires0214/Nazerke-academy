'use client';

import { useEffect,useRef,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Content,ContentInput } from '@/lib/content';
import { assetNames } from '@/lib/catalog';
import { putDirectVideo } from '@/lib/video-client';
import { eventTimeFromInput,localEventTime } from '@/lib/event-time';
import { apiCall,messageFor } from './actions';
import { StudioPicker,type StudioOption } from './studio-picker';
import { audienceLabels,kindLabels,mediaDetail,mediaKindLabels,statusLabels,studioKindGroups,type StudioAudience,type StudioKind,type StudioMedia } from './studio-labels';

export type EditorChoice = Pick<Content,'id'|'title'|'slug'|'kind'|'status'|'parent_id'|'audience'>;
const coverLabels = [
  'Kenwood', 'Кухонный комбайн', 'Кубикорезка', 'Тестораскатка', 'Лапшерезка', 'Мясорубка',
  'Шнековая соковыжималка', 'Блендер', 'Крюк', 'Венчик', 'Паста', 'Бисквит', 'Хлеб', 'Манты',
  'Смузи', 'Салат', 'Суп', 'Пицца', 'Тесто', 'Уход и очистка', 'Тирамису',
];
const coverOptions=assetNames.map((name,index)=>({value:name+'.webp',label:coverLabels[index],image:'/assets/'+name+'.webp',keywords:name}));
const publicKinds=new Set<StudioKind>(['post','event','section']);
const recipeLinks=new Set<StudioKind>(['attachment','collection','lesson','course']);

function readEditorData(kind:StudioKind,form:FormData,previous?:Content['data']):Partial<ContentInput['data']> {
  const value=(key:string)=>String(form.get(key)??'');
  const lines=(key:string)=>value(key).split('\n').map(line=>line.trim()).filter(Boolean);
  const number=(key:string)=>value(key)?Number(value(key)):undefined;
  const base={...previous,body:value('body')};
  switch(kind){
    case 'recipe': return {...base,category:value('category'),duration:number('duration'),portions:number('portions'),
      ingredients:lines('ingredients'),steps:lines('steps'),settings:value('settings')};
    case 'attachment': return {...base,model:value('model'),assembly:value('assembly'),usage:value('usage'),care:value('care'),mistakes:value('mistakes')};
    case 'collection': return {...base,shoppingList:lines('shoppingList'),prepPlan:lines('prepPlan')};
    case 'post': return {...base,postKind:value('postKind') as ContentInput['data']['postKind']};
    case 'event': return {...base,city:value('city').trim()||undefined,venueAddress:value('venueAddress').trim()||undefined,
      startsAt:value('startsAt')?eventTimeFromInput(value('startsAt')):undefined,capacity:number('capacity')};
    default: return base;
  }
}

function KindFields({kind,data}:{kind:StudioKind;data?:Content['data']}) {
  const text=(name:'settings'|'assembly'|'usage'|'care'|'mistakes',label:string)=>
    <label>{label}<textarea name={name} rows={3} defaultValue={data?.[name]}/></label>;
  const list=(name:'ingredients'|'steps'|'shoppingList'|'prepPlan',label:string)=>
    <label>{label}<textarea name={name} rows={4} defaultValue={data?.[name]?.join('\n')}/><small>По одной строке на пункт.</small></label>;
  switch(kind){
    case 'recipe': return <>
      <div className="form-grid"><label>Категория<input name="category" maxLength={120} defaultValue={data?.category}/></label>
        <label>Время, мин<input name="duration" type="number" min={1} max={2880} defaultValue={data?.duration}/></label>
        <label>Порции<input name="portions" type="number" min={1} max={100} defaultValue={data?.portions}/></label></div>
      {list('ingredients','Ингредиенты')}{list('steps','Шаги приготовления')}{text('settings','Параметры Kenwood')}
    </>;
    case 'attachment': return <>
      <label>Модель<input name="model" maxLength={120} defaultValue={data?.model}/></label>
      {text('assembly','Сборка')}{text('usage','Применение')}{text('care','Уход')}{text('mistakes','Типичные ошибки')}
    </>;
    case 'collection': return <>{list('shoppingList','Общий список покупок')}{list('prepPlan','План подготовки')}</>;
    case 'post': return <label>Рубрика<select name="postKind" defaultValue={data?.postKind??'article'}>
      <option value="article">Статья</option><option value="news">Новости</option><option value="offer">Предложение</option><option value="faq">FAQ</option>
    </select></label>;
    case 'event': return <>
      <div className="form-grid">
        <label>Город<input name="city" maxLength={120} defaultValue={data?.city}/></label>
        <label>Адрес встречи<input name="venueAddress" maxLength={300} defaultValue={data?.venueAddress}/></label>
        <label>Дата и время (Кызылорда)<input name="startsAt" type="datetime-local" defaultValue={data?.startsAt?localEventTime(data.startsAt):undefined}/></label>
        <label>Общее количество мест<input name="capacity" type="number" min={1} max={1000} defaultValue={data?.capacity}/></label>
      </div>
      <p className="studio-hint">Свободные места рассчитываются по подтверждённым записям.</p>
    </>;
    default: return null;
  }
}

export function CmsEditor({node,nodes,media,allowedKinds,initialKind,canPublish,canArchive,canUpload,links,mediaIds}:{
  node?:Content;nodes:EditorChoice[];media:StudioMedia[];allowedKinds:StudioKind[];
  initialKind?:StudioKind;canPublish:boolean;canArchive:boolean;canUpload:boolean;links:string[];mediaIds:string[];
}) {
  const [kind,setKind]=useState<StudioKind>(()=>(node?.kind as StudioKind|undefined)??initialKind??allowedKinds[0]);
  const [audience,setAudience]=useState<StudioAudience>(()=>(node?.audience as StudioAudience|undefined)??'academy');
  const [parentId,setParentId]=useState(node?.parent_id??'');
  const [cover,setCover]=useState(node?.cover??'');
  const [linked,setLinked]=useState(links);
  const [attached,setAttached]=useState(mediaIds);
  const [uploaded,setUploaded]=useState<StudioMedia[]>([]);
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [refreshing,startTransition]=useTransition();
  const ordering=useRef<HTMLDetailsElement>(null);
  const router=useRouter();
  const currentStatus=node?.status??'draft';
  const pending=saving||refreshing;
  const needsParent=kind==='module'||kind==='lesson';
  const parentLabel=kind==='module'?'Курс':'Модуль';
  const parent=needsParent?nodes.find(item=>item.id===parentId):undefined;
  const effectiveAudience=(parent?.audience as StudioAudience|undefined)??audience;
  const linkKind=kind==='recipe'?'attachment':recipeLinks.has(kind)?'recipe':null;
  const parentOptions=needsParent?nodes.filter(item=>item.kind===(kind==='module'?'course':'module')).map((item):StudioOption=>{
    const course=kind==='lesson'?nodes.find(candidate=>candidate.id===item.parent_id):undefined;
    return {value:item.id,label:item.title,detail:[course?.title,audienceLabels[item.audience as StudioAudience],statusLabels[item.status]].filter(Boolean).join(' · '),keywords:item.slug};
  }):[];
  const linkOptions=linkKind?nodes.filter(item=>item.kind===linkKind).map(item=>({
    value:item.id,label:item.title,detail:statusLabels[item.status],keywords:item.slug,
  })):[];
  const received=new Map(media.map(item=>[item.id,item]));
  const mediaList=[...uploaded.map(item=>({...item,...received.get(item.id),name:item.name})),
    ...media.filter(item=>!uploaded.some(file=>file.id===item.id))];
  const mediaOptions=mediaList.filter(item=>effectiveAudience!=='public'||item.kind!=='video'||attached.includes(item.id)).map(item=>({
    value:item.id,label:item.name??mediaKindLabels[item.kind]??'Файл',detail:mediaDetail(item),keywords:mediaKindLabels[item.kind],
  }));
  const hasVideo=mediaList.some(item=>item.kind==='video'&&attached.includes(item.id));
  const hasProcessing=mediaList.some(item=>item.state!=='ready'&&attached.includes(item.id));
  const saveButton=(value:Content['status'],label:string,primary=false)=><button type="submit" name="nextStatus" value={value}
    className={primary?'btn btn-dark':'btn btn-outline'} disabled={pending||uploading}>{label}</button>;

  return <form className="form-stack studio-editor" onSubmit={async event=>{
    event.preventDefault();
    if(pending||uploading)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter;
    const nextStatus=submitter instanceof HTMLButtonElement ? submitter.value as Content['status'] : currentStatus;
    const form=new FormData(event.currentTarget);
    const value=(key:string)=>String(form.get(key)??'');
    if(needsParent&&!parent){setNotice(kind==='module'?'Выберите курс для модуля.':'Выберите модуль для урока.');return;}
    if(effectiveAudience==='public'&&hasVideo){setNotice(messageFor('PUBLIC_VIDEO_FORBIDDEN'));return;}
    if(nextStatus==='published'&&hasProcessing){setNotice('Дождитесь готовности выбранных файлов перед публикацией.');return;}
    setNotice('');
    setSaving(true);
    try {
      const payload={
        kind,slug:value('slug'),title:value('title'),description:value('description'),language:value('language') as ContentInput['language'],
        audience:effectiveAudience,status:nextStatus,parentId:needsParent?parentId:null,sortOrder:Number(value('sortOrder')),
        cover:cover||null,links:linkKind?linked:[],mediaIds:attached,version:node?.version,data:readEditorData(kind,form,node?.data),
      };
      const result=await apiCall('/api/studio/content'+(node?'/'+node.id:''),payload,node?'PATCH':'POST');
      setNotice(nextStatus==='published'?'Материал опубликован.':'Материал сохранён.');
      startTransition(()=>{if(node)router.refresh();else router.replace('/admin/edit/'+result.id);});
    }catch(error){setNotice((error as Error).message);}
    finally{setSaving(false);}
  }}>
    <p className="studio-meta">Статус <strong>{statusLabels[currentStatus]}</strong></p>
    <div className="studio-form-section">
      <div className="form-grid">
        {node?<div className="studio-meta">Тип материала <strong>{kindLabels[kind]}</strong></div>:<label>Тип материала
          <select value={kind} onChange={event=>{
            const next=event.target.value as StudioKind;
            setKind(next);
            setParentId('');
            setLinked([]);
            if(!publicKinds.has(next)&&audience==='public')setAudience('academy');
            setNotice('');
          }}>{studioKindGroups.map(group=>{
            const types=group.kinds.filter(item=>allowedKinds.includes(item));
            return types.length?<optgroup key={group.label} label={group.label}>{types.map(item=>
              <option key={item} value={item}>{kindLabels[item]}</option>)}</optgroup>:null;
          })}</select>
        </label>}
        <label>Язык<select name="language" defaultValue={node?.language??'RU'}><option value="RU">Русский</option><option value="KZ">Қазақша</option></select></label>
      </div>
      <label>Название<input name="title" defaultValue={node?.title} required maxLength={200}/></label>
      {needsParent?<div key={kind}>
        <StudioPicker label={parentLabel} emptyLabel={kind==='module'?'Выбрать курс':'Выбрать модуль'} options={parentOptions} value={parentId?[parentId]:[]}
          onChange={value=>setParentId(value[0]??'')} required/>
        <p className="studio-hint">{parent?`Доступ: ${audienceLabels[effectiveAudience]} · из выбранного ${kind==='module'?'курса':'модуля'}`:
          `Доступ берётся из ${kind==='module'?'курса':'модуля'}.`}</p>
      </div>:<label>Кому видно<select name="audience" value={audience} onChange={event=>setAudience(event.target.value as StudioAudience)}>
        <option value="academy">{audienceLabels.academy}</option><option value="ambassador">{audienceLabels.ambassador}</option>
        {publicKinds.has(kind)?<option value="public">{audienceLabels.public}</option>:null}
      </select></label>}
      <label>Краткое описание<textarea name="description" rows={3} defaultValue={node?.description} maxLength={2000}/></label>
      <details className="studio-disclosure" ref={ordering} open={!node?true:undefined}>
        <summary>Адрес и порядок</summary>
        <div className="form-grid">
          <label>Адрес на сайте<input name="slug" defaultValue={node?.slug} required pattern="[a-z0-9][a-z0-9\-]{0,99}" maxLength={100}
            onInvalid={()=>{if(ordering.current)ordering.current.open=true;}}/><small>Латинские буквы, цифры и дефисы.</small></label>
          <label>Порядок<input name="sortOrder" type="number" min={0} max={100000} defaultValue={node?.sort_order??0}
            onInvalid={()=>{if(ordering.current)ordering.current.open=true;}}/></label>
        </div>
      </details>
    </div>
    <section className="studio-form-section" aria-label="Содержание">
      <h2>Содержание</h2>
      <KindFields key={kind} kind={kind} data={node?.data}/>
      <label>{kind==='lesson'?'Текст урока':'Основной текст'}<textarea name="body" rows={7} maxLength={50000} defaultValue={node?.data.body}/>
        <small>Начните строку с «## », чтобы сделать заголовок.</small></label>
      {linkKind?<StudioPicker key={linkKind} label={linkKind==='attachment'?'Нужные насадки':'Связанные рецепты'}
        emptyLabel={linkKind==='attachment'?'Выбрать насадки':'Выбрать рецепты'} options={linkOptions} value={linked} onChange={setLinked} limit={100}/>:null}
    </section>
    <section className="studio-form-section" aria-label="Обложка и медиа">
      <h2>Обложка и медиа</h2>
      <StudioPicker label="Обложка из библиотеки" emptyLabel="Выбрать обложку" options={coverOptions}
        value={cover?[cover]:[]} onChange={value=>setCover(value[0]??'')} clearable/>
      <StudioPicker label="Прикреплённые файлы" emptyLabel="Выбрать существующие файлы" options={mediaOptions} value={attached} onChange={setAttached} limit={20}/>
      {effectiveAudience==='public'&&hasVideo?<p className="studio-hint" role="status">Чтобы открыть материал всем, уберите из него видео.</p>:null}
      {hasProcessing?<div>
        <p className="studio-hint" role="status">Для публикации все выбранные файлы должны быть готовы. Пока можно сохранить черновик.</p>
        <button type="button" className="btn btn-outline" disabled={pending||uploading}
          onClick={()=>startTransition(()=>router.refresh())}>Обновить статусы файлов</button>
      </div>:null}
      {canUpload?<details className="studio-disclosure">
        <summary>{effectiveAudience==='public'?'Загрузить изображение или PDF':'Загрузить видео или файл'}</summary>
        <MediaUpload allowVideo={effectiveAudience!=='public'} disabled={pending||attached.length>=20}
          onBusyChange={setUploading} onUploaded={file=>{
            setUploaded(files=>[file,...files]);
            setAttached(ids=>ids.length<20?[...ids,file.id]:ids);
          }}/>
      </details>:null}
    </section>
    <div className="detail-actions studio-editor-actions">
      {currentStatus!=='archived'||canArchive?saveButton(currentStatus,currentStatus==='draft'?'Сохранить черновик':'Сохранить изменения',true):null}
      {canPublish&&currentStatus!=='published'?saveButton('published','Опубликовать'):null}
      {canPublish&&currentStatus==='published'?saveButton('hidden','Снять с публикации'):null}
      {node&&['hidden','archived'].includes(currentStatus)?saveButton('draft','Вернуть в черновики'):null}
      {node&&canArchive&&currentStatus!=='archived'?saveButton('archived','Архивировать'):null}
    </div>
    <p role="status">{pending?'Сохраняем…':notice}</p>
  </form>;
}

export function MediaUpload({allowVideo=true,disabled=false,onUploaded,onBusyChange}:{
  allowVideo?:boolean;disabled?:boolean;onUploaded?:(media:StudioMedia)=>void;onBusyChange?:(busy:boolean)=>void;
}={}) {
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  const [selected,setSelected]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const uploadRef=useRef<AbortController|null>(null);
  const router=useRouter();
  useEffect(()=>()=>{uploadRef.current?.abort();},[]);
  async function upload(){
    const file=fileRef.current?.files?.[0];
    if(!file||disabled||uploadRef.current)return;
    const controller=new AbortController();
    uploadRef.current=controller;
    setPending(true);
    onBusyChange?.(true);
    setStatus('');
    try {
      const video=file.type.startsWith('video/');
      if(video&&!allowVideo)throw new Error('Видео можно прикрепить только к закрытому материалу.');
      if(video&&file.size>200*1024*1024)throw new Error('Выберите видео до 200 МБ.');
      if(!video&&file.size>4000000)throw new Error('Выберите изображение или PDF до 4 МБ.');
      let id:string;
      if(video){
        const media=await apiCall('/api/studio/media/mux',{},'POST',controller.signal);
        id=media.id;
        try{await putDirectVideo(media.uploadUrl,file,AbortSignal.any([controller.signal,AbortSignal.timeout(15*60000)]));}
        catch{throw new Error('Не удалось загрузить видео. Повторите загрузку.');}
        setStatus('Видео загружено и обрабатывается.');
      }else{
        const response=await fetch('/api/studio/media/upload',{method:'POST',headers:{'Content-Type':file.type},body:file,signal:controller.signal});
        const result=await response.json();
        if(!response.ok)throw new Error(messageFor(result.error));
        id=result.id;
        setStatus('Файл загружен.');
      }
      if(fileRef.current)fileRef.current.value='';
      setSelected(false);
      onUploaded?.({id,kind:video?'video':file.type==='application/pdf'?'document':'image',state:video?'processing':'ready',created_at:new Date().toISOString(),name:file.name});
      router.refresh();
    }catch(error){if(!controller.signal.aborted)setStatus((error as Error).message);}
    finally{
      if(!controller.signal.aborted){setPending(false);onBusyChange?.(false);}
      if(uploadRef.current===controller)uploadRef.current=null;
    }
  }
  return <div className="form-stack studio-upload">
    <label>Выберите файл
      <input ref={fileRef} type="file" name="file" accept={'image/jpeg,image/png,image/webp,application/pdf'+(allowVideo?',video/*':'')}
        disabled={disabled||pending} onChange={event=>setSelected(!!event.target.files?.length)}/>
      <small>Изображение или PDF до 4 МБ{allowVideo?', видео до 200 МБ':''}.</small>
    </label>
    <button type="button" className="btn btn-dark" disabled={disabled||pending||!selected} onClick={()=>void upload()}>{pending?'Загружаем…':'Загрузить'}</button>
    <p role="status">{status}</p>
  </div>;
}
