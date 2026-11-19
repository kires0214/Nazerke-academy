'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { grants } from '@/lib/catalog';
import { apiCall } from './actions';
const grantNames:Partial<Record<typeof grants[number],string>>={
  'audit.read':'Журнал действий и посещений','media.delete':'Удаление файлов и видео',
  'content.delete':'Архивирование и удаление контента','content.publish':'Публикация и снятие с публикации',
  'students.block':'Блокировка и разблокировка аккаунтов',
};
export function StaffControls({id,role,currentGrants}:{id:string;role:string;currentGrants:string[]}) {
  const [status,setStatus]=useState('');const router=useRouter();
  return <details><summary>Роль и точечные права · Tech Admin</summary><form className="form-stack" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);try{await apiCall('/api/studio/accounts/'+id,{action:'staff',role:String(form.get('role')),grants:form.getAll('grants').map(String)});setStatus('Права сохранены. Сессии пользователя отозваны.');router.refresh();}catch(error){setStatus((error as Error).message);}}}><label>Роль<select name="role" defaultValue={role==='admin'?'admin':'student'}><option value="student">Ученик</option><option value="admin">Администратор</option></select></label><fieldset><legend>Разрешения администратора</legend>{grants.map(grant=><label className="checkbox" key={grant}><input type="checkbox" name="grants" value={grant} defaultChecked={currentGrants.includes(grant)}/>{grantNames[grant]??grant}</label>)}</fieldset><p>Изменение роли очищает учебные допуски. Доступ к обучению назначается отдельно.</p><button className="btn btn-dark">Сохранить роль и права</button><p role="status">{status}</p></form></details>;
}
