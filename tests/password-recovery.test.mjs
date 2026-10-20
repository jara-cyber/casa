import {test} from 'node:test';import assert from 'node:assert/strict';
import {recoveryCallback,recoverySession,saveRecoveredPassword,authMessage} from '../src/password-recovery.ts';
test('Detecta recuperación y enlaces caducados sin interpretar tokens como permisos',()=>{
 assert.deepEqual(recoveryCallback('https://example.org/casa/#type=recovery&access_token=secret'),{requested:true,invalid:false});
 assert.equal(recoveryCallback('https://example.org/casa/#error=access_denied&error_code=otp_expired').invalid,true);
 assert.equal(recoveryCallback('https://example.org/casa/').requested,false);
});
test('El modo de recuperación persiste solo para su cuenta y durante 30 minutos',()=>{
 assert.equal(recoverySession(JSON.stringify({userId:'a',until:1500}),'a',1000),true);
 assert.equal(recoverySession(JSON.stringify({userId:'a',until:1500}),'b',1000),false);
 assert.equal(recoverySession(JSON.stringify({userId:'a',until:500}),'a',1000),false);
 assert.equal(recoverySession('{broken','a',1000),false);
});
test('No guarda contraseñas diferentes, cortas ni errores del proveedor',async()=>{
 let calls=0;const update=async()=>{calls++;return {error:null}};
 await assert.rejects(()=>saveRecoveredPassword('short','short',update),/12 y 128/);
 await assert.rejects(()=>saveRecoveredPassword('password-long-1','password-long-2',update),/no coinciden/);
 assert.equal(calls,0);
 let saved;await saveRecoveredPassword('password-long-1','password-long-1',async input=>{saved=input;return {error:null}});
 assert.deepEqual(saved,{password:'password-long-1',data:{must_change_password:false}});
 await assert.rejects(()=>saveRecoveredPassword('password-long-1','password-long-1',async()=>({error:new Error('Provider failure')})),/Provider failure/);
 assert.match(authMessage({code:'same_password'}),/diferente/);
 assert.match(authMessage({status:429}),/Espera/);
});
