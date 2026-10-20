import {test} from 'node:test';import assert from 'node:assert/strict';
import {pushFailure} from '../src/push-errors.ts';
const http=(status,body)=>({context:new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})});
test('Una prueba repetida no se presenta como función sin desplegar',async()=>{
 const r=await pushFailure(http(400,{error:'Activa los avisos y espera un minuto entre pruebas'}));assert.equal(r.cooldown,true);assert.match(r.message,/no necesitas volver a instalarlo/);
});
test('Distingue sesión, función inexistente y fallos del servidor',async()=>{
 assert.match((await pushFailure(http(401,{message:'Invalid JWT'}))).message,/sesión/);
 assert.match((await pushFailure(http(404,{}))).message,/No se encuentra/);
 assert.match((await pushFailure(http(500,{}))).message,/500/);
});
test('Conserva el error seguro del servidor y distingue falta de conexión',async()=>{
 assert.equal((await pushFailure(http(500,{error:'No se pudo completar el envío.'}))).message,'No se pudo completar el envío.');
 assert.match((await pushFailure(new Error('fetch failed'))).message,/conexión/);
 assert.equal((await pushFailure(http(429,{}))).cooldown,true);
});
