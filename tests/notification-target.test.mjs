import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {notificationItem,notificationPage} from '../src/notification-target.ts';
const id='00000000-0000-4000-8000-000000000001';
test('El destino valida UUID y conserva el registro tras el inicio de sesión',()=>{
 assert.equal(notificationItem('https://example.org/casa/?item='+id),id);
 assert.equal(notificationItem('https://example.org/casa/?item=https://evil.example'),null);
 assert.equal(notificationItem('https://example.org/casa/'),null);
 assert.equal(notificationPage({kind:'event',date:'2026-10-01T10:00:00Z'},Date.parse('2026-10-25T10:00:00Z')),'calendar');
 assert.equal(notificationPage({kind:'event',date:'2026-11-01T10:00:00Z'},Date.parse('2026-10-25T10:00:00Z')),'event');
 assert.equal(notificationPage({kind:'task',date:''}),'task');
});
async function worker(windows=[]){
 const handlers={},opened=[],navigated=[];let stored,focused=0,pending;
 const clients={matchAll:async()=>windows.map(url=>({url,navigate:async target=>{navigated.push(target);return {focus:async()=>{focused++}}}})),openWindow:async url=>opened.push(url)};
 const self={registration:{scope:'https://example.org/casa/',showNotification:async(title,data)=>{stored=data}},addEventListener:(type,fn)=>{handlers[type]=fn},skipWaiting:()=>{}};
 const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
 vm.runInNewContext(source,{self,clients,URL});
 return {
  async receive(data){handlers.push({data:{json:()=>data},waitUntil:p=>{pending=p}});await pending;return stored},
  async click(data){handlers.notificationclick({notification:{data,close(){}},waitUntil:p=>{pending=p}});await pending},
  opened,navigated,focus:()=>focused
 };
}
test('El receptor conserva el identificador y abre el registro con la app cerrada',async()=>{
 const w=await worker();const data=await w.receive({itemId:id,body:'Recordatorio'});
 assert.equal(data.data.itemId,id);await w.click(data.data);
 assert.equal(w.opened[0],'https://example.org/casa/?item='+id);
});
test('Si Casa está abierta navega al registro y enfoca la ventana existente',async()=>{
 const w=await worker(['https://example.org/casa/?other=1']);
 await w.click({itemId:id});
 assert.equal(w.navigated[0],'https://example.org/casa/?item='+id);
 assert.equal(w.focus(),1);assert.equal(w.opened.length,0);
});
test('No permite destinos externos y conserva compatibilidad con avisos antiguos',async()=>{
 const w=await worker(['https://example.org/casa-otra/']);
 await w.click({url:'https://evil.example',itemId:'../outside'});
 assert.equal(w.opened[0],'https://example.org/casa/');assert.equal(w.navigated.length,0);
 const data=await w.receive({itemId:'https://evil.example'});assert.equal(data.data.itemId,null);
});
