import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Actividad: nuevos registros por familia, privacidad, destinatarios y duplicados',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;
 grant usage on schema auth,public to authenticated,anon,service_role;`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 let sql=await readFile(new URL('../supabase/push.sql',import.meta.url),'utf8');
 sql=sql.replace(/^create extension.*$/gm,'').replace(/^select cron.schedule.*$/gm,'');
 // pg_net no está disponible en PGlite; solo sustituimos el transporte externo.
 await db.exec("create schema net;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;");
 await db.exec(sql);await db.exec(sql);
 const activity=await readFile(new URL('../supabase/push-activity.sql',import.meta.url),'utf8');
 await db.exec(activity);await db.exec(activity);
 const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
 async function login(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",[ids[n],n+'@example.org']);await db.exec('set role authenticated')}
 await db.query('insert into auth.users values($1),($2),($3)',ids);
 await login(0);const fid=(await db.query("select create_family('A','Ana') id")).rows[0].id;
 const invite=(await db.query("select invite_member('1@example.org','B') id")).rows[0].id;
 await login(1);await db.query('select join_family($1)',[invite]);
 await login(2);await db.query("select create_family('C','C')");
 await db.exec('reset role');
 await db.exec("insert into push_config(id,public_key,private_key,dispatch_token,contact,function_url) values(true,'public','SECRET','TOKEN','mailto:x@example.org','https://example.org')");
 for(let n=0;n<3;n++){await login(n);await db.query('select register_push($1,$2,$3)',['https://fcm.googleapis.com/send/'+n,'a'.repeat(87),'b'.repeat(22)])}
 await assert.rejects(()=>db.query('select * from push_config'),/permission denied/);
 await assert.rejects(()=>db.query('select claim_push()'),/permission denied/);
 assert.equal((await db.query('select * from push_subscriptions')).rows.length,1);
 assert.equal((await db.query('select push_status() s')).rows[0].s.publicKey,'public');
 await assert.rejects(()=>db.query('select register_push($1,$2,$3)',['http://localhost/internal','a'.repeat(87),'b'.repeat(22)]),/no válida/);
 await login(0);
 const kinds=['task','event','shopping','meal','expense','link'];
 for(const kind of kinds)for(const scope of ['private','family'])await db.query("insert into items(family_id,owner_id,scope,kind,text) values($1,$2,$3,$4,'CONTENIDO SENSIBLE')",[fid,ids[0],scope,kind]);
 await assert.rejects(()=>db.query('select * from push_activity_deliveries'),/permission denied/);
 await assert.rejects(()=>db.query('select * from claim_activity_push()'),/permission denied/);
 await db.exec('reset role;set role service_role');
 const first=(await db.query('select * from claim_activity_push()')).rows;
 const second=(await db.query('select * from claim_activity_push()')).rows;
 const rows=[...first,...second];
 assert.equal(rows.length,12);
 assert.equal(rows.filter(r=>r.endpoint.endsWith('/0')).length,6);
 assert.equal(rows.filter(r=>r.endpoint.endsWith('/1')).length,6);
 assert.equal(rows.filter(r=>r.endpoint.endsWith('/2')).length,0);
 assert.ok(rows.some(r=>r.body==='Nueva tarea de Ana. Abre Casa para verlo.'));
 assert.ok(rows.some(r=>r.body==='Nueva cita de Ana. Abre Casa para verlo.'));
 assert.ok(rows.every(r=>!r.body.includes('CONTENIDO SENSIBLE')));
 assert.equal((await db.query('select * from claim_activity_push()')).rows.length,0);
 await db.exec("update push_activity_deliveries set sent_at=now(),leased_until=now()-interval '1 minute'");
 assert.equal((await db.query('select * from claim_activity_push()')).rows.length,0);
 // La eliminación antes de enviar cancela los avisos pendientes.
 await login(0);
 const doomed=(await db.query("insert into items(family_id,owner_id,scope,kind,text) values($1,$2,'family','task','Eliminar antes de enviar') returning id",[fid,ids[0]])).rows[0].id;
 await db.query('delete from items where id=$1',[doomed]);
 await db.exec('reset role;set role service_role');
 assert.equal((await db.query('select * from claim_activity_push()')).rows.length,0);
 // Un destinatario que sale de la familia no recibe avisos pendientes.
 await login(0);
 await db.query("insert into items(family_id,owner_id,scope,kind,text) values($1,$2,'family','task','Cambio de miembros')",[fid,ids[0]]);
 await db.exec('reset role');
 await db.query('update profiles set family_id=(select family_id from profiles where id=$1) where id=$2',[ids[2],ids[1]]);
 await db.exec('set role service_role');
 const afterMove=(await db.query('select * from claim_activity_push()')).rows;
 assert.equal(afterMove.length,1);assert.ok(afterMove[0].endpoint.endsWith('/0'));
 }finally{await db.close()}
});
