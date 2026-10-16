export type ChatItem={id:string;owner:string;scope:string;kind:string;text:string;date:string;amount:number;done:number;extra:string};
export type ChatData={me:{id:string;name:string};items:ChatItem[]};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function dayKey(date:Date,timeZone='Europe/Madrid'){return date.toLocaleDateString('sv-SE',{timeZone})}
export function addDays(key:string,n:number){return new Date(Date.parse(key+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export function visibleItems(data:ChatData){return data.items.filter(x=>x.scope==='family'||x.owner===data.me.id)}
function itemDay(x:ChatItem,tz:string){if(/^\d{4}-\d{2}-\d{2}$/.test(x.date))return x.date;return Number.isFinite(Date.parse(x.date))?dayKey(new Date(x.date),tz):''}
export function answerQuestion(question:string,data:ChatData,now=new Date(),timeZone='Europe/Madrid'){
 const q=normalize(question),today=dayKey(now,timeZone),all=visibleItems(data);
 const wantsPrivate=/\b(solo yo|mi espacio|personal|personales|privado|privadas)\b/.test(q),wantsFamily=/\b(familia|familiar|compartid)/.test(q);
 let items=all.filter(x=>!wantsPrivate||x.scope==='private').filter(x=>!wantsFamily||x.scope==='family');
 const label=wantsPrivate?'tu espacio personal':wantsFamily?'el espacio familiar':'tu agenda personal y familiar';
 const list=(records:ChatItem[],empty:string,withTime=false)=>records.length?records.slice(0,30).map(x=>'• '+x.text+(withTime?' · '+new Date(x.date).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone}):'')+(x.scope==='family'?' (familia)':' (personal)')).join('\n')+(records.length>30?'\n… y '+(records.length-30)+' registros más.':''):empty;
 let text='',selected=items;
 if(/compr|falta|despensa|supermercado|pan\b/.test(q)){selected=items.filter(x=>x.kind==='shopping'&&!x.done);text='En la lista de compra pendiente:\n'+list(selected,'No hay productos pendientes.');}
 else if(/gast|dinero|pagad|cuenta|presupuesto/.test(q)){selected=items.filter(x=>x.kind==='expense'&&x.date.startsWith(today.slice(0,7)));const sum=selected.reduce((n,x)=>n+x.amount,0);text='Este mes llevas '+new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(sum/100)+' en gastos registrados'+(wantsPrivate?' personales':wantsFamily?' familiares':' visibles para tu cuenta')+'.\n'+list(selected,'Todavía no hay gastos este mes.');}
 else if(/tarea|pendiente|debere/.test(q)&&!/manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo/.test(q)){selected=items.filter(x=>x.kind==='task'&&!x.done);text='Tus tareas pendientes:\n'+list(selected,'No hay tareas pendientes.');}
 else if(/comer|comemos|comida|menu|cena|plato/.test(q)){let key=/pasado manana/.test(q)?addDays(today,2):/manana/.test(q)?addDays(today,1):/hoy/.test(q)?today:'';let weekday=key?new Date(key+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'long',timeZone:'UTC'}):'';selected=items.filter(x=>x.kind==='meal'&&(!weekday||normalize(x.extra)===normalize(weekday)));text=(weekday?'Menú del '+weekday+':':'El menú semanal registrado:')+'\n'+list(selected,'No hay ningún plato planificado'+(weekday?' para ese día.':'.'));}
 else {
 let target=/pasado manana/.test(q)?addDays(today,2):/manana/.test(q)?addDays(today,1):/\bhoy\b/.test(q)?today:'';
 const explicit=q.match(/\b(\d{4}-\d{2}-\d{2})\b/);if(explicit&&Number.isFinite(Date.parse(explicit[1]+'T12:00:00Z')))target=explicit[1];
 const weekdays=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];if(!target){let index=weekdays.findIndex(d=>q.includes(d));if(index>=0){let current=new Date(today+'T12:00:00Z').getUTCDay();let offset=(index-current+7)%7;target=addDays(today,offset===0?7:offset)}}
 const next=/semana|proxim|agenda|cita|medico|reunion/.test(q);
 if(target||next){selected=items.filter(x=>x.kind==='event'&&!x.done&&(target?itemDay(x,timeZone)===target:Date.parse(x.date)>=+now));if(!target&&/semana/.test(q))selected=selected.filter(x=>itemDay(x,timeZone)<=addDays(today,7));selected=selected.slice().sort((a,b)=>a.date.localeCompare(b.date));const dateLabel=target?new Date(target+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}):'los próximos días';text='Para '+dateLabel+', en '+label+':\n'+list(selected,'No tienes citas registradas'+(target?' para ese día.':'.'),true);if(!target&&selected.length)text+='\n\nFechas: '+selected.map(x=>x.text+' — '+itemDay(x,timeZone)).join('; ');}
 else {selected=[];text='Puedo consultar tus citas, tareas, compras, menú y gastos. Prueba «¿Qué tengo mañana?», «¿Qué falta por comprar?» o «¿Cuánto llevo gastado este mes?». También puedes añadir «solo yo» o «familia». Las tareas sin fecha no se pueden asignar a mañana.';}
 }
 return {text,items:selected,today,timeZone};
}
export function localOllamaUrl(value:string){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw Error('Usa una dirección local, por ejemplo http://localhost:11434');return u.origin}
