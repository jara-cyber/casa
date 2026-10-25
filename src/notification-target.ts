const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function notificationItem(href:string){try{const id=new URL(href).searchParams.get('item');return id&&uuid.test(id)?id:null}catch{return null}}
export function notificationPage(item:{kind:string;date:string},now=Date.now()){
 if(item.kind==='event')return Date.parse(item.date)<now?'calendar':'event';
 return ['task','shopping','meal','expense'].includes(item.kind)?item.kind:'home';
}
