'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { grants } from '@/lib/catalog';
import { apiCall } from './actions';

type Permission=typeof grants[number];
const grantNames:Record<Permission,string>={
  'content.read':'Открывать контент и предпросмотр','content.edit':'Создавать и редактировать материалы',
  'content.publish':'Публиковать и снимать с публикации','content.delete':'Архивировать и удалять материалы',
  'sections.manage':'Управлять разделами','courses.manage':'Управлять курсами, модулями и уроками',
  'recipes.manage':'Управлять рецептами','events.manage':'Управлять мастер-классами',
  'announcements.manage':'Управлять статьями и анонсами','media.upload':'Загружать файлы и видео',
  'media.delete':'Удалять файлы и видео','students.read':'Открывать список учеников и заявок',
  'students.approve':'Рассматривать заявки и подтверждать доступ','students.block':'Блокировать и разблокировать аккаунты',
  'devices.reset':'Сбрасывать привязку браузера','ambassadors.assign':'Назначать доступ амбассадорам',
  'support.read':'Читать обращения','support.respond':'Отвечать на обращения',
  'analytics.read':'Доступ к аналитике','audit.read':'Открывать журнал действий и посещений',
};
const groups=[
  {label:'Контент',items:['content.read','content.edit','content.publish','content.delete','courses.manage','recipes.manage','sections.manage','events.manage','announcements.manage']},
  {label:'Медиа',items:['media.upload','media.delete']},
  {label:'Пользователи и доступ',items:['students.read','students.approve','students.block','devices.reset','ambassadors.assign']},
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

export function RegistrationControls({id,canAssignAmbassador,canAssignAdmin}:{
  id:string;canAssignAmbassador:boolean;canAssignAdmin:boolean;
}) {
  const [role,setRole]=useState('student');
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
      await apiCall('/api/studio/registration/'+id,{action:'invite',role,grants:role==='admin'?selected:[]});
      setStatus('Приглашение сохранено.');
      router.refresh();
    }catch(error){setStatus((error as Error).message);}
    finally{setPending(false);}
  }}>
    <label>Роль при приглашении<select name="inviteRole" value={role} onChange={event=>setRole(event.target.value)}>
      <option value="student">Ученик</option>
      {canAssignAmbassador?<option value="ambassador">Амбассадор</option>:null}
      {canAssignAdmin?<option value="admin">Администратор</option>:null}
    </select></label>
    {role==='admin'?<>
      <GrantGroups selected={selected} setSelected={setSelected}/>
      <p className="studio-hint">Учебный допуск администратору можно выдать отдельно.</p>
    </>:null}
    {role==='ambassador'?<p className="studio-hint">Откроются Академия и программа амбассадоров.</p>:null}
    <button type="submit" className="btn btn-dark" disabled={pending}>{pending?'Сохраняем…':'Пригласить'}</button>
    <p role="status">{status}</p>
  </form>;
}

export function StaffControls({id,role,currentGrants,approved}:{id:string;role:string;currentGrants:string[];approved:boolean}) {
  const [selectedRole,setRole]=useState(role);
  const [selected,setSelected]=useState(currentGrants);
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  const router=useRouter();
  const changed=selectedRole!==role||selectedRole==='admin'&&
    (selected.length!==currentGrants.length||selected.some(grant=>!currentGrants.includes(grant)));
  const valid=selectedRole==='student'||selectedRole==='admin'||selectedRole==='ambassador'&&approved;
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
        {approved||role==='ambassador'?<option value="ambassador">Амбассадор</option>:null}
        <option value="admin">Администратор</option>
      </select></label>
      {selectedRole==='admin'?<GrantGroups selected={selected} setSelected={setSelected}/>:null}
      {changed?<p className="studio-hint">{selectedRole==='ambassador'?
        'Пользователь войдёт заново. Откроются Академия и программа амбассадоров.':
        'Пользователь войдёт заново. Учебный допуск нужно выдать отдельно.'}</p>:null}
      <button type="submit" className="btn btn-dark" disabled={!changed||!valid||pending}>Сохранить роль и права</button>
      <p role="status">{status}</p>
    </form>
  </details>;
}
