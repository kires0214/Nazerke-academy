'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteModeLabels,learningTracks,trackLabels,type InviteMode,type LearningTrack,type grants } from '@/lib/catalog';
import { apiCall } from './actions';

type Permission=typeof grants[number];
const grantNames:Record<Permission,string>={
  'content.read':'Открывать контент и предпросмотр','content.edit':'Создавать и редактировать материалы',
  'content.publish':'Публиковать и снимать с публикации','content.delete':'Архивировать и удалять материалы',
  'sections.manage':'Управлять разделами и файлами','courses.manage':'Управлять курсами, модулями и уроками',
  'recipes.manage':'Управлять рецептами, насадками и подборками','events.manage':'Управлять мастер-классами',
  'announcements.manage':'Управлять статьями и анонсами','media.upload':'Загружать файлы и видео',
  'media.delete':'Удалять файлы и видео','students.read':'Открывать список учеников и заявок',
  'students.approve':'Создавать приглашения, рассматривать заявки и подтверждать доступ','students.block':'Блокировать, архивировать и восстанавливать аккаунты',
  'devices.reset':'Сбрасывать привязку браузера','ambassadors.assign':'Выдавать допуск только к Школе Амбассадора','students.tracks':'Назначать допуски Kenwood, Braun и Школы Амбассадора',
  'support.read':'Читать обращения','support.respond':'Отвечать на обращения',
  'analytics.read':'Доступ к аналитике','audit.read':'Открывать журнал действий и посещений',
};
const groups=[
  {label:'Контент',items:['content.read','content.edit','content.publish','content.delete','courses.manage','recipes.manage','sections.manage','events.manage','announcements.manage']},
  {label:'Медиа',items:['media.upload','media.delete']},
  {label:'Пользователи и доступ',items:['students.read','students.approve','students.block','devices.reset','students.tracks','ambassadors.assign']},
  {label:'Поддержка и журнал',items:['support.read','support.respond','audit.read','analytics.read']},
] satisfies {label:string;items:Permission[]}[];

function GrantGroups({selected,setSelected}:{selected:string[];setSelected:(items:string[])=>void}) {
  return <div className="studio-grant-groups">
    {groups.map(group=><fieldset key={group.label}>
      <legend>{group.label}</legend>
      {group.items.map(grant=><label className="checkbox" key={grant}>
        <input type="checkbox" name="grants" value={grant} checked={selected.includes(grant)}
          onChange={event=>setSelected(event.target.checked?[...selected,grant]:selected.filter(item=>item!==grant))}/>
        {grantNames[grant]}
      </label>)}
    </fieldset>)}
  </div>;
}

export function TrackChoices({selected,onChange,onlyAmbassador=false,joint=false,publicSelected=false,onPublicChange}:{
  selected:readonly LearningTrack[];onChange:(tracks:LearningTrack[])=>void;onlyAmbassador?:boolean;joint?:boolean;
  publicSelected?:boolean;onPublicChange?:(checked:boolean)=>void;
}) {
  return <fieldset className="track-choices">
    <legend>{joint?'Кому видно':'Учебные допуски'}</legend>
    {onPublicChange?<label className="checkbox"><input type="checkbox" checked={publicSelected}
      onChange={event=>onPublicChange(event.target.checked)}/>Все посетители</label>:null}
    {learningTracks.map(track=><label key={track} className="checkbox">
      <input type="checkbox" checked={publicSelected||selected.includes(track)} disabled={publicSelected||onlyAmbassador&&track!=='ambassador'}
        onChange={event=>onChange(event.target.checked?[...selected,track]:selected.filter(item=>item!==track))}/>
      {trackLabels[track]}
    </label>)}
  </fieldset>;
}

export function StudentTrackControls({id,current,onlyAmbassador=false}:{id:string;current:LearningTrack[];onlyAmbassador?:boolean}) {
  const [tracks,setTracks]=useState(current),[pending,setPending]=useState(false),[status,setStatus]=useState('');
  const router=useRouter();
  const changed=tracks.length!==current.length||tracks.some(track=>!current.includes(track));
  return <details className="studio-disclosure staff-permissions">
    <summary>Учебные допуски</summary>
    <form className="form-stack" onSubmit={async event=>{
      event.preventDefault();
      if(pending||!changed)return;
      setPending(true);setStatus('');
      try{
        await apiCall('/api/studio/accounts/'+id,onlyAmbassador?{action:'ambassador',enabled:tracks.includes('ambassador')}:{action:'tracks',tracks});
        setStatus('Допуски сохранены. Ученик войдёт заново.');router.refresh();
      }catch(error){setStatus((error as Error).message);}
      finally{setPending(false);}
    }}>
      <TrackChoices selected={tracks} onChange={setTracks} onlyAmbassador={onlyAmbassador}/>
      <button className="btn btn-dark" disabled={pending||!changed}>Сохранить допуски</button>
      <p role="status">{status}</p>
    </form>
  </details>;
}

export function CreateInvitation() {
  const [mode,setMode]=useState<InviteMode>('single');
  const [url,setUrl]=useState('');
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  const router=useRouter();
  return <section className="studio-record form-stack">
    <h2>Ссылка-приглашение без заказа</h2>
    <label>Тип ссылки<select value={mode} disabled={pending} onChange={event=>setMode(event.target.value==='multi'?'multi':'single')}>
      {Object.entries(inviteModeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    <p>{mode==='single'?'Один человек может подать заявку в течение 3 дней.':'Несколько человек могут подать заявки по этой ссылке в течение 3 дней.'} Для заявки нужны контакт Telegram, фамилия и имя.</p>
    <button type="button" className="btn btn-dark" disabled={pending} onClick={async()=>{
      setPending(true);
      setStatus('');
      setUrl('');
      try{
        const result=await apiCall('/api/studio/invitations',{mode});
        setUrl(result.url);
        router.refresh();
      }catch(error){setStatus((error as Error).message);}
      finally{setPending(false);}
    }}>{pending?'Создаём…':'Создать приглашение'}</button>
    {url?<div className="form-stack">
      <label>Ссылка для отправки<input value={url} readOnly onFocus={event=>event.target.select()}/></label>
      <button type="button" className="btn btn-outline" onClick={async()=>{
        try{await navigator.clipboard.writeText(url);setStatus('Ссылка скопирована.');}
        catch{setStatus('Выделите и скопируйте ссылку из поля.');}
      }}>Скопировать ссылку</button>
    </div>:null}
    <p role="status">{status}</p>
  </section>;
}

export function RegistrationControls({id,canAssignTracks,canAssignAdmin}:{
  id:string;canAssignTracks:boolean;canAssignAdmin:boolean;
}) {
  const [role,setRole]=useState('student');
  const [tracks,setTracks]=useState<LearningTrack[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  const router=useRouter();
  return <form className="form-stack studio-invite" onSubmit={async event=>{
    event.preventDefault();
    if(pending)return;
    setPending(true);
    setStatus('');
    try{
      await apiCall('/api/studio/registration/'+id,{action:'invite',role,grants:role==='admin'?selected:[],...(role==='student'&&canAssignTracks?{tracks}:{})});
      setStatus('Приглашение сохранено.');
      router.refresh();
    }catch(error){setStatus((error as Error).message);}
    finally{setPending(false);}
  }}>
    <label>Роль при приглашении<select name="inviteRole" value={role} onChange={event=>setRole(event.target.value)}>
      <option value="student">Ученик</option>
      {canAssignAdmin?<option value="admin">Администратор</option>:null}
    </select></label>
    {role==='admin'?<>
      <GrantGroups selected={selected} setSelected={setSelected}/>
      <p className="studio-hint">Учебный допуск администратору можно выдать отдельно.</p>
    </>:null}
    {role==='student'&&canAssignTracks?<TrackChoices selected={tracks} onChange={setTracks}/>:null}
    <button type="submit" className="btn btn-dark" disabled={pending}>{pending?'Сохраняем…':'Пригласить'}</button>
    <p role="status">{status}</p>
  </form>;
}

export function StaffControls({id,role,currentGrants}:{id:string;role:string;currentGrants:string[]}) {
  const [selectedRole,setRole]=useState(role);
  const [selected,setSelected]=useState(currentGrants);
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  const router=useRouter();
  const changed=selectedRole!==role||selectedRole==='admin'&&
    (selected.length!==currentGrants.length||selected.some(grant=>!currentGrants.includes(grant)));
  const valid=selectedRole==='student'||selectedRole==='admin';
  return <details className="studio-disclosure staff-permissions">
    <summary>Роль и разрешения</summary>
    <form className="form-stack" onSubmit={async event=>{
      event.preventDefault();
      if(!changed||!valid||pending)return;
      setPending(true);
      setStatus('');
      try{
        await apiCall('/api/studio/accounts/'+id,{action:'staff',role:selectedRole,grants:selectedRole==='admin'?selected:[]});
        setStatus('Права сохранены. Сеансы пользователя отозваны.');
        router.refresh();
      }catch(error){setStatus((error as Error).message);}
      finally{setPending(false);}
    }}>
      <label>Роль<select name="role" value={selectedRole} onChange={event=>setRole(event.target.value)}>
        <option value="student">Ученик</option>
        <option value="admin">Администратор</option>
      </select></label>
      {selectedRole==='admin'?<GrantGroups selected={selected} setSelected={setSelected}/>:null}
      {changed?<p className="studio-hint">Пользователь войдёт заново. Проверьте учебные допуски после смены роли.</p>:null}
      <button type="submit" className="btn btn-dark" disabled={!changed||!valid||pending}>Сохранить роль и права</button>
      <p role="status">{status}</p>
    </form>
  </details>;
}
