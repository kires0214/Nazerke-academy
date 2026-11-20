import Link from 'next/link';
import { localEventTime,eventTimeZone } from '@/lib/event-time';
import type { CalendarEvent } from '@/lib/events';

const monthFormat=new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'long',timeZone:'UTC'});
const clockFormat=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:eventTimeZone});
const dayFormat=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:eventTimeZone});
const weekdays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const monthOf=(date:Date)=>date.toISOString().slice(0,7);

export function EventCalendar({items,month,base,canOpenDetails}:{
  items:CalendarEvent[];month:unknown;base:'/events'|'/academy/events';canOpenDetails:boolean;
}) {
  const today=localEventTime(new Date()).slice(0,10);
  const current=typeof month==='string'&&/^(20|21)\d\d-(0[1-9]|1[0-2])$/.test(month)?month:today.slice(0,7);
  const date=new Date(current+'-01T00:00:00Z');
  const year=date.getUTCFullYear(),index=date.getUTCMonth();
  const previous=monthOf(new Date(Date.UTC(year,index-1,1))),next=monthOf(new Date(Date.UTC(year,index+1,1)));
  const offset=(date.getUTCDay()+6)%7,lastDay=new Date(Date.UTC(year,index+1,0)).getUTCDate();
  const days=Array.from({length:Math.ceil((offset+lastDay)/7)*7},(_,index)=>index-offset+1);
  const visible=items.flatMap(item=>{
    const value=item.node.data.startsAt;
    if(!value)return [];
    const localDay=localEventTime(value).slice(0,10);
    return localDay.startsWith(current+'-')?[{...item,localDay,startsAt:value}]:[];
  }).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const byDay=new Map<string,typeof visible>();
  for(const event of visible){
    const dayEvents=byDay.get(event.localDay)??[];
    dayEvents.push(event);
    byDay.set(event.localDay,dayEvents);
  }
  const title=monthFormat.format(date);
  return <section className="event-calendar" aria-label="Календарь мастер-классов">
    <div className="calendar-heading">
      <Link className="btn btn-outline" href={base+'?month='+previous} aria-label="Предыдущий месяц">←</Link>
      <h2>{title}</h2>
      <Link className="btn btn-outline" href={base+'?month='+next} aria-label="Следующий месяц">→</Link>
    </div>
    <div className="calendar-grid">
      {weekdays.map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
      {days.map(day=>{
        if(day<1||day>lastDay)return <span key={day} aria-hidden="true" className="calendar-spacer"/>;
        const iso=current+'-'+String(day).padStart(2,'0');
        const count=byDay.get(iso)?.length??0;
        const dateMarker=iso===today?'date':undefined;
        return count?<a key={day} className="calendar-day has-events" href={'#meetings-'+iso}
          aria-current={dateMarker} aria-label={`${day} · встреч: ${count}`}>
          <span>{day}</span><small>{count}</small>
        </a>:<span className="calendar-day" key={day} aria-current={dateMarker}>{day}</span>;
      })}
    </div>
    {byDay.size?[...byDay].map(([day,events])=><section key={day} id={'meetings-'+day} className="calendar-agenda">
      <h3>{dayFormat.format(new Date(events[0].startsAt))}</h3>
      {events.map(({node,remaining,startsAt})=><article className="calendar-meeting" key={node.id}>
        <div>
          <p className="calendar-time"><time dateTime={startsAt}>{clockFormat.format(new Date(startsAt))}</time></p>
          <h4>{node.title}</h4>
          <p>{[node.data.city,node.data.venueAddress].filter(Boolean).join(' · ')||'Адрес уточняется'}</p>
          {remaining!==null?<p>{remaining>0?`Свободно мест: ${remaining} из ${node.data.capacity}`:'Мест нет, доступен лист ожидания'}</p>:null}
        </div>
        <Link className="btn btn-outline" href={canOpenDetails?'/academy/events/'+node.slug:'/login'}>
          {canOpenDetails?'Подробнее':'Войти для записи'}
        </Link>
      </article>)}
    </section>):<p className="empty">На этот месяц мастер-классы пока не запланированы.</p>}
  </section>;
}
