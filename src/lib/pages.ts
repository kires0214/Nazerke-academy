import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { withDb } from './db';
import { cookieNames } from './http';
import { isStudioRole, principal } from './security';
import { academyCatalog } from './content';
import { AppError } from './errors';

export const pageTokens=cache(async()=>{const jar=await cookies(),names=cookieNames();return {session:jar.get(names.session)?.value,device:jar.get(names.device)?.value};});
const readPageUser=cache(async()=>{
  const tokens=await pageTokens();
  if(!tokens.session||!tokens.device)return null;
  return withDb(db=>principal(db,tokens,true));
});
export const publicPageUser=cache(async()=>{
  if(!process.env.DATABASE_URL)return null;
  try{return await readPageUser();}
  catch(error){
    if(!(error instanceof AppError&&[401,403].includes(error.status)))console.error('JUICY public session check unavailable');
    return null;
  }
});
export const pageUser=cache(async()=>{
  try {return await readPageUser()??redirect('/login');}
  catch(error) {if(error instanceof AppError&&error.status===401) redirect('/login');throw error;}
});
export const academyData=cache(async()=>{
  const tokens=await pageTokens();if(!tokens.session||!tokens.device) redirect('/login');
  try {return await withDb(async db=>{
    const user=await principal(db,tokens);
    const {nodes,catalog}=await academyCatalog(db,user);
    const progress=(await db.query<{lesson_id:string;completed_at:string|null;position_seconds:number;last_opened_at:string}>('SELECT lesson_id,completed_at,position_seconds,last_opened_at FROM lesson_progress WHERE user_id=$1 ORDER BY last_opened_at DESC',[user.id])).rows.filter(x=>nodes.some(n=>n.id===x.lesson_id));
    const favorites=(await db.query<{content_id:string}>('SELECT content_id FROM favorites WHERE user_id=$1',[user.id])).rows.map(x=>x.content_id);
    const links=(await db.query<{source_id:string;target_id:string}>('SELECT source_id,target_id FROM content_links')).rows.filter(x=>nodes.some(n=>n.id===x.source_id)&&nodes.some(n=>n.id===x.target_id));
    return {user,nodes,catalog,progress,favorites,links};
  });} catch(error) {
    if(error instanceof AppError&&error.status===401) redirect('/login');
    if(error instanceof AppError&&error.status===403) redirect('/access');
    throw error;
  }
});
export const studioData=cache(async()=>{
  const user=await pageUser().catch(error=>{
    if(error instanceof AppError&&error.status===403) redirect('/login');
    throw error;
  });
  if(user.status!=='approved') redirect('/access');
  if(!isStudioRole(user.role)) redirect('/academy');
  return {user};
});
