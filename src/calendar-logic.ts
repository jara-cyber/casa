export type CalendarEvent={id:string;kind:string;date:string;text:string;owner:string;scope:string};
export function dateKey(date:Date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
export function monthDays(year:number,month:number){
 const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7;
 return Array.from({length:42},(_,i)=>new Date(year,month,1-offset+i,12));
}
export function eventsByDay<T extends CalendarEvent>(items:T[]){
 const result:Record<string,T[]>={};
 for(const item of items){if(item.kind!=='event')continue;const date=new Date(item.date);if(!Number.isFinite(+date))continue;const key=dateKey(date);(result[key]??=[]).push(item)}
 for(const events of Object.values(result))events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.text.localeCompare(b.text));
 return result;
}
