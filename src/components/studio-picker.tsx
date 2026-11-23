'use client';

import { useId,useState } from 'react';

export type StudioOption = {value:string;label:string;detail?:string;image?:string;keywords?:string;disabled?:boolean};

export function StudioPicker({label,options,value,onChange,limit=1,clearable=false,emptyLabel,required=false}:{
  label:string;
  options:StudioOption[];
  value:string[];
  onChange:(value:string[])=>void;
  limit?:number;
  clearable?:boolean;
  emptyLabel:string;
  required?:boolean;
}) {
  const id=useId();
  const [query,setQuery]=useState('');
  const term=query.trim().toLocaleLowerCase('ru');
  const available=options.filter(option=>!term||[option.label,option.detail,option.keywords].some(text=>text?.toLocaleLowerCase('ru').includes(term)));
  const byValue=new Map(options.map(option=>[option.value,option]));
  const multiple=limit>1;
  const display=value.map(id=>({id,...byValue.get(id),title:byValue.get(id)?.label??id.slice(0,8)}));
  const summary=multiple&&value.length ? `${emptyLabel} · выбрано ${value.length}` : display[0]?.title??emptyLabel;
  return <div className="studio-picker">
    <span className="studio-field-label" id={id}>{label}{required?' *':''}</span>
    <details>
      <summary aria-labelledby={`${id} ${id}-choice`}><span id={`${id}-choice`}>{summary}</span></summary>
      <div className="studio-picker-menu">
        <label className="studio-picker-search"><span className="sr-only">Поиск · {label}</span>
          <input type="search" value={query} placeholder="Поиск" maxLength={120}
            onChange={event=>setQuery(event.target.value)}
            onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}}/>
        </label>
        {available.length ? <ul className="studio-picker-options" aria-labelledby={id}>
          {available.map(option=>{
            const selected=value.includes(option.value);
            const disabled=option.disabled||multiple&&value.length>=limit&&!selected;
            return <li key={option.value}>
              <button type="button" aria-pressed={selected} disabled={disabled} onClick={event=>{
                if(multiple){
                  onChange(selected?value.filter(id=>id!==option.value):[...value,option.value]);
                }else{
                  onChange([option.value]);
                  setQuery('');
                  const details=event.currentTarget.closest('details');
                  if(details){details.open=false;details.querySelector('summary')?.focus();}
                }
              }}>
                {option.image?<img src={option.image} alt="" width="40" height="40" loading="lazy"/>:null}
                <span><strong>{option.label}</strong>{option.detail?<small>{option.detail}</small>:null}</span>
                {selected?<span className="studio-picker-check" aria-hidden="true">✓</span>:null}
              </button>
            </li>;
          })}
        </ul>:<p className="studio-picker-empty" role="status">{query?'Ничего не найдено.':'В списке пока ничего нет.'}</p>}
        {multiple&&value.length>=limit?<p className="studio-picker-empty">Достигнут предел выбора ({limit}).</p>:null}
      </div>
    </details>
    {(multiple||clearable)&&display.length>0?<ul className="studio-picker-chips" aria-label={`Выбрано · ${label}`}>
      {display.map(option=><li key={option.id}>
        <span>{option.title}</span>
        <button type="button" aria-label={`Убрать ${option.title}`} onClick={()=>onChange(value.filter(id=>id!==option.id))}>×</button>
      </li>)}
    </ul>:null}
  </div>;
}
