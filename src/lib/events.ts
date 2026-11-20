import type { Content } from './content';
import type { Db } from './db';

export type CalendarEvent={node:Content;remaining:number|null};

export async function eventsWithSeats(db:Db,nodes:Content[]):Promise<CalendarEvent[]> {
  const events=nodes.filter(node=>node.kind==='event');
  if(!events.length)return [];
  const {rows}=await db.query<{id:string;booked:number}>(`SELECT event_id AS id,count(*)::int AS booked
    FROM event_registrations WHERE event_id=ANY($1::uuid[]) AND status='registered' GROUP BY event_id`,[events.map(node=>node.id)]);
  const booked=new Map(rows.map(row=>[row.id,row.booked]));
  return events.map(node=>({node,remaining:node.data.capacity?Math.max(0,node.data.capacity-(booked.get(node.id)??0)):null}));
}
