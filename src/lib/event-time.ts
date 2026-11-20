export const eventTimeZone='Asia/Qyzylorda';

const localClock=new Intl.DateTimeFormat('sv-SE',{
  timeZone:eventTimeZone,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});

export function localEventTime(value:string|Date) {
  const fields=new Map(localClock.formatToParts(new Date(value)).map(({type,value})=>[type,value]));
  return `${fields.get('year')}-${fields.get('month')}-${fields.get('day')}T${fields.get('hour')}:${fields.get('minute')}`;
}

export function eventTimeFromInput(value:string) {
  const naive=Date.parse(value+'Z');
  const local=Date.parse(localEventTime(new Date(naive))+'Z');
  return new Date(2*naive-local).toISOString();
}
