import {test} from 'node:test';import assert from 'node:assert/strict';
import {agendaEvents} from '../src/agenda-events.ts';
test('Agenda oculta citas pasadas sin borrar el historial usado por Calendario',()=>{
 const past={id:'past',kind:'event',date:'2026-10-22T09:00:00Z'},future={id:'future',kind:'event',date:'2026-10-22T11:00:00Z'};
 const items=[past,future,{id:'task',kind:'task',date:'2026-10-23T00:00:00Z'}];
 assert.deepEqual(agendaEvents(items,Date.parse('2026-10-22T10:00:00Z')),[future]);
 assert.equal(items.length,3);assert.equal(items[0],past);
});
test('El límite compara instantes y no el texto de la zona horaria',()=>{
 const exact={id:'now',kind:'event',date:'2026-10-22T12:00:00+02:00'};
 const earlier={id:'earlier',kind:'event',date:'2026-10-22T09:59:59Z'};
 assert.deepEqual(agendaEvents([earlier,exact],Date.parse('2026-10-22T10:00:00Z')),[exact]);
 assert.deepEqual(agendaEvents([exact],Date.parse('2026-10-22T10:00:01Z')),[]);
});
test('Ordena las futuras y descarta fechas inválidas',()=>{
 const a={id:'a',kind:'event',date:'2026-10-22T10:30:00Z'},b={id:'b',kind:'event',date:'2026-10-22T10:15:00Z'};
 assert.deepEqual(agendaEvents([a,{kind:'event',date:'invalid'},b],Date.parse('2026-10-22T10:00:00Z')),[b,a]);
});
