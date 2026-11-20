import Link from 'next/link';
import { localEventTime,eventTimeZone } from '@/lib/event-time';
import type { CalendarEvent } from '@/lib/events';
import { copy,type SiteLocale } from '@/lib/locale';
import { catalogUrl,type CatalogSearch } from '@/lib/catalog-search';


const monthOf=(date:Date)=>date.toISOString().slice(0,7);

export function EventCalendar({items,month,base,canOpenDetails,locale='ru',filters}:{
  items:CalendarEvent[];month:unknown;base:'/events'|'/academy/events';canOpenDetails:boolean;locale?:SiteLocale;filters?:CatalogSearch;
}) {
  const t=copy(locale);
  const monthFormat=new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',timeZone:'UTC'});
  const clockFormat=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:eventTimeZone});
  const dayFormat=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long',timeZone:eventTimeZone});
  const weekdays=locale==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
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
  return <section className="event-calendar" aria-label={t('Календарь мастер-классов','Masterclass calendar')}>
    <div className="calendar-heading">
      <Link className="btn btn-outline" href={catalogUrl(base,{month:previous,...filters})} aria-label={t('Предыдущий месяц','Previous month')}>←</Link>
      <h2>{title}</h2>
      <Link className="btn btn-outline" href={catalogUrl(base,{month:next,...filters})} aria-label={t('Следующий месяц','Next month')}>→</Link>
    </div>
    <div className="calendar-grid">
      {weekdays.map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
      {days.map(day=>{
        if(day<1||day>lastDay)return <span key={day} aria-hidden="true" className="calendar-spacer"/>;
        const iso=current+'-'+String(day).padStart(2,'0');
        const count=byDay.get(iso)?.length??0;
        const dateMarker=iso===today?'date':undefined;
        return count?<a key={day} className="calendar-day has-events" href={'#meetings-'+iso}
          aria-current={dateMarker} aria-label={`${day} · ${t("встреч","events")}: ${count}`}>
          <span>{day}</span><small>{count}</small>
        </a>:<span className="calendar-day" key={day} aria-current={dateMarker}>{day}</span>;
      })}
    </div>
    {byDay.size?[...byDay].map(([day,events])=><section key={day} id={'meetings-'+day} className="calendar-agenda">
      <h3>{dayFormat.format(new Date(events[0].startsAt))}</h3>
      {events.map(({node,remaining,startsAt})=><article className="calendar-meeting" key={node.id}>
        <div>
          {!node.locked?<p className="calendar-time"><time dateTime={startsAt}>{clockFormat.format(new Date(startsAt))}</time></p>:null}
          <h4>{node.title}</h4>
          {node.locked?<p>{t('Требуется допуск','Access required')}</p>:
            <p>{[node.data.city,node.data.venueAddress].filter(Boolean).join(' · ')||t('Адрес уточняется','Address to be confirmed')}</p>}
          {remaining!==null?<p>{remaining>0?t(`Свободно мест: ${remaining} из ${node.data.capacity}`,`Seats available: ${remaining} of ${node.data.capacity}`):t('Мест нет, доступен лист ожидания','Fully booked. You can join the waitlist.')}</p>:null}
        </div>
        <Link className="btn btn-outline" href={canOpenDetails?'/academy/events/'+node.slug:'/login'}>
          {node.locked?t('Узнать о доступе','Check access'):canOpenDetails?t('Подробнее','Details'):t('Войти для записи','Sign in to book')}
        </Link>
      </article>)}
    </section>):<p className="empty">{t('На этот месяц мастер-классы пока не запланированы.','No masterclasses are scheduled for this month.')}</p>}
  </section>;
}
