import {test} from 'node:test';import assert from 'node:assert/strict';
import {monthDays,dateKey,eventsByDay} from '../src/calendar-logic.ts';
test('Mes en seis semanas, empieza en lunes y conserva cambio de año',()=>{
 const days=monthDays(2026,0);assert.equal(days.length,42);assert.equal(days[0].getDay(),1);
 assert.equal(dateKey(days[0]),'2025-12-29');assert.ok(days.some(d=>dateKey(d)==='2026-01-31'));
});
test('Calendario usa días locales y orden cronológico, sin incluir otros registros',()=>{
 const row=(id,kind,date)=>({id,kind,date,text:id,owner:'a',scope:'family'});
 const grouped=eventsByDay([row('tarde','event','2026-10-21T18:00:00'),row('temprano','event','2026-10-21T09:00:00'),row('compra','shopping','2026-10-21'),row('invalida','event','invalid')]);
 assert.deepEqual(Object.keys(grouped),['2026-10-21']);assert.deepEqual(grouped['2026-10-21'].map(x=>x.id),['temprano','tarde']);
});
test('Un día por celda también durante el cambio de horario de octubre',()=>{
 const days=monthDays(2026,9);assert.equal(new Set(days.map(dateKey)).size,42);
 assert.ok(days.some(d=>dateKey(d)==='2026-10-25'));
});
