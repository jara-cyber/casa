self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch{}
 event.waitUntil(self.registration.showNotification('Casa',{
 body:typeof data.body==='string'?data.body:'Tienes un recordatorio. Abre Casa para verlo.',
 tag:typeof data.tag==='string'?data.tag:'casa-reminder',
 icon:new URL('icon.svg',self.registration.scope).href,
 data:{url:self.registration.scope}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
 const target=self.registration.scope;
 const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){if(client.url.startsWith(target)){await client.focus();return}}
 await clients.openWindow(target);
 })());
});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
// No se almacenan respuestas ni datos privados en caché.
