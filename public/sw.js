const itemPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch{}
 const itemId=typeof data.itemId==='string'&&itemPattern.test(data.itemId)?data.itemId:null;
 event.waitUntil(self.registration.showNotification('Casa',{
 body:typeof data.body==='string'?data.body:'Tienes un recordatorio. Abre Casa para verlo.',
 tag:typeof data.tag==='string'?data.tag:'casa-reminder',
 icon:new URL('icon.svg',self.registration.scope).href,
 data:{itemId}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
 const target=new URL(self.registration.scope);
 const itemId=event.notification.data?.itemId;
 if(typeof itemId==='string'&&itemPattern.test(itemId))target.searchParams.set('item',itemId);
 const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){
  const current=new URL(client.url);
  if(current.origin===target.origin&&current.pathname.startsWith(target.pathname)){
   try{const navigated=await client.navigate(target.href);if(navigated){await navigated.focus();return}}catch{}
  }
 }
 await clients.openWindow(target.href);
 })());
});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
// La notificación contiene solo el identificador. Los detalles se consultan tras iniciar sesión y aplicar RLS.
// No se almacenan respuestas ni datos privados en caché.
