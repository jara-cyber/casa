import {useState} from 'react';
import type {ReactNode} from 'react';
import {dateKey,monthDays,eventsByDay} from './calendar-logic';
type Event={id:string;owner:string;scope:string;kind:string;text:string;date:string;amount:number;done:number;reminder:number;extra:string};
export default function Calendar({items,renderEvent}:{items:Event[];renderEvent:(event:Event)=>ReactNode}){
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [selected,setSelected]=useState(()=>dateKey(new Date()));
 const grouped=eventsByDay(items),days=monthDays(month.getFullYear(),month.getMonth()),today=dateKey(new Date());
 const time=(value:string)=>new Date(value).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
 const selectedDate=new Date(selected+'T12:00:00');
 function move(delta:number){const next=new Date(month.getFullYear(),month.getMonth()+delta,1,12);setMonth(next);setSelected(dateKey(next))}
 return <section className="card casa-calendar"><div className="calendar-toolbar"><div><h2>{month.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</h2><p>Las mismas citas de Agenda, organizadas por día.</p></div><div className="calendar-navigation"><button className="ghost" onClick={()=>move(-1)} aria-label="Mes anterior">‹</button><button className="ghost" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));setSelected(dateKey(now))}}>Hoy</button><button className="ghost" onClick={()=>move(1)} aria-label="Mes siguiente">›</button></div></div>
 <div className="calendar-weekdays" aria-hidden="true">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><span key={d}>{d}</span>)}</div>
 <div className="calendar-days">{days.map(day=>{const key=dateKey(day),events=grouped[key]||[];return <button key={key} type="button" className={'calendar-day'+(day.getMonth()!==month.getMonth()?' outside':'')+(key===today?' today':'')+(key===selected?' chosen':'')} aria-pressed={key===selected} aria-current={key===today?'date':undefined} aria-label={day.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+', '+events.length+' citas'} onClick={()=>{setSelected(key);if(day.getMonth()!==month.getMonth())setMonth(new Date(day.getFullYear(),day.getMonth(),1,12))}}>
 <span className="calendar-number">{day.getDate()}</span><span className="calendar-previews">{events.slice(0,2).map(event=><span key={event.id} className={'calendar-chip '+(event.scope==='private'?'personal':'shared')}><b>{time(event.date)}</b> {event.text}</span>)}{events.length>2&&<span className="calendar-more">+{events.length-2} más</span>}</span>{events.length>0&&<span className="calendar-mobile-count">{events.length} {events.length===1?'cita':'citas'}</span>}
 </button>})}</div>
 <div className="calendar-detail" aria-live="polite"><h2>{selectedDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>{(grouped[selected]||[]).map(renderEvent)}{!grouped[selected]?.length&&<p className="empty">No hay citas para este día en la vista elegida.</p>}</div>
 </section>
}
