import {test} from 'node:test';import assert from 'node:assert/strict';
import {passwordHandler} from '../supabase/functions/casa-admin/index.ts';
const actorId='00000000-0000-4000-8000-000000000001',targetId='00000000-0000-4000-8000-000000000002';
function setup(options={}){
 const writes=[];
 const ports={actor:async()=>({id:actorId,email:'owner@example.org'}),owner:async id=>id===actorId,account:async id=>({id,email:'member@example.org',user_metadata:{name:'Ana'}}),update:async(...args)=>{writes.push(args)},...options};
 const handle=passwordHandler(ports);
 const request=(overrides={},token='verified-token')=>handle(new Request('https://example.org',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'password',userId:targetId,confirmEmail:'member@example.org',password:'temporary-password-1',...overrides})}));
 return {writes,request};
}
test('Solo una sesión del propietario puede cambiar otras contraseñas',async()=>{
 for(const overrides of [{actor:async()=>null},{owner:async()=>false}]){
  const s=setup(overrides);assert.ok([401,403].includes((await s.request()).status));assert.equal(s.writes.length,0);
 }
 const s=setup();assert.equal((await s.request({},'')).status,401);assert.equal(s.writes.length,0);
});
test('Valida confirmación y longitud antes del cambio',async()=>{
 const s=setup();
 assert.equal((await s.request({confirmEmail:'wrong@example.org'})).status,400);
 assert.equal((await s.request({password:'short'})).status,400);
 assert.equal((await s.request({password:'a'.repeat(129)})).status,400);
 assert.equal(s.writes.length,0);
});
test('Guarda contraseña sin correo y conserva metadatos con aviso de cambio',async()=>{
 const s=setup(),response=await s.request();assert.equal(response.status,200);
 assert.deepEqual(s.writes,[[targetId,'temporary-password-1',{name:'Ana',must_change_password:true}]]);
 const body=await response.text();assert.ok(!body.includes('temporary-password-1'));assert.ok(!body.includes('verified-token'));
});
test('Protege a otros propietarios; permite cambiar la cuenta propia',async()=>{
 const s=setup({owner:async()=>true});assert.equal((await s.request()).status,403);assert.equal(s.writes.length,0);
 const own=setup();assert.equal((await own.request({userId:actorId})).status,200);assert.equal(own.writes[0][2].must_change_password,false);
});
test('No modifica nada si el propietario pierde permisos durante la operación',async()=>{
 let calls=0;const s=setup({owner:async id=>id===actorId&&++calls===1});
 assert.equal((await s.request()).status,403);assert.equal(s.writes.length,0);
});
