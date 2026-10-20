import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Push: destinatarios privados, familias, arrendamientos y borrados',async()=>{
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
 await db.exec(sql);await db.exec(sql); // migración repetible
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
 const date=new Date(Date.now()+30*60000).toISOString();
 for(const scope of ['private','family'])await db.query("insert into items(family_id,owner_id,scope,kind,text,date,reminder) values($1,$2,$3,'event','Privado',$4,60)",[fid,ids[0],scope,date]);
 await db.exec('reset role;set role service_role');
 const rows=(await db.query('select * from claim_push()')).rows;
 assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.endpoint.endsWith('/0')).length,2);assert.equal(rows.filter(r=>r.endpoint.endsWith('/1')).length,1);assert.equal(rows.filter(r=>r.endpoint.endsWith('/2')).length,0);
 assert.equal((await db.query('select * from claim_push()')).rows.length,0);
 await db.query('update push_deliveries set sent_at=now() where id=$1',[rows[0].delivery_id]);
 await db.exec("update push_deliveries set leased_until=now()-interval '1 minute'");
 assert.equal((await db.query('select * from claim_push()')).rows.length,2);
 await db.exec("reset role;update items set done=true;update push_deliveries set leased_until=now()-interval '1 minute'");
 assert.equal((await db.query('select * from claim_push()')).rows.length,0);
 await db.exec('reset role;delete from items');assert.equal((await db.query('select * from push_deliveries')).rows.length,0);
 }finally{await db.close()}
});
