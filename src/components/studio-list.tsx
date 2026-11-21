'use client';

import { useState,type ReactNode } from 'react';

type Filter={key:string;label:string;options:readonly (readonly [string,string])[]};
type StudioRow={id:string;terms:string;values?:Record<string,string[]>;content:ReactNode};

export function StudioList({rows,filters,searchLabel,empty}:{
  rows:StudioRow[];filters:Filter[];searchLabel:string;empty:string;
}) {
  const [query,setQuery]=useState('');
  const [selection,setSelection]=useState<Record<string,string>>({});
  const clean=(value:string)=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
  const words=clean(query).split(/\s+/).filter(Boolean);
  const filtered=rows.filter(row=>words.every(word=>clean(row.terms).includes(word))&&
    filters.every(({key})=>!selection[key]||row.values?.[key]?.includes(selection[key])));
  const hasFilter=!!query||Object.values(selection).some(Boolean);
  return <>
    <div className="studio-list-toolbar">
      <label>{searchLabel}<input type="search" value={query} maxLength={120} onChange={event=>setQuery(event.target.value)}/></label>
      {filters.map(({key,label,options})=><label key={key}>{label}<select value={selection[key]??''}
        onChange={event=>setSelection({...selection,[key]:event.target.value})}>
        <option value="">Все</option>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}
      </select></label>)}
      {hasFilter?<button className="btn btn-outline" type="button" onClick={()=>{setQuery('');setSelection({});}}>Сбросить</button>:null}
    </div>
    <p className="studio-list-count" role="status">Показано {filtered.length} из {rows.length}</p>
    {filtered.length?<div className="studio-list-rows">{filtered.map(row=><div key={row.id}>{row.content}</div>)}</div>:
      <p className="empty">{hasFilter?'По этому запросу ничего не найдено.':empty}</p>}
  </>;
}
