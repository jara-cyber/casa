import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Cartas: persistencia, fotos y permisos entre cuentas y familias',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;grant usage on schema auth,public to authenticated,anon;`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 const sql=await readFile(new URL('../supabase/reyes.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
 await db.query('insert into auth.users values($1),($2),($3)',ids);
 async function login(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",[ids[n],n+'@example.org']);await db.exec('set role authenticated')}
 await login(0);const family=(await db.query("select create_family('Casa','Ana') id")).rows[0].id;
 const invite=(await db.query("select invite_member('1@example.org','Luis') id")).rows[0].id;
 await login(1);await db.query('select join_family($1)',[invite]);await login(2);await db.query("select create_family('Otra','Eva')");await login(0);
 await db.query("insert into reyes_letters(family_id,owner_id,season,message) values($1,$2,2027,'Queridos Reyes')",[family,ids[0]]);
 const wish=(await db.query("insert into reyes_wishes(family_id,owner_id,season,name,photo) values($1,$2,2027,'Bicicleta','data:image/jpeg;base64,YWJj') returning id",[family,ids[0]])).rows[0].id;
 await db.query("update reyes_wishes set notes='Roja' where id=$1",[wish]);
 await assert.rejects(()=>db.query("update reyes_wishes set photo='javascript:alert(1)' where id=$1",[wish]),/check constraint/);
 await login(1);assert.equal((await db.query('select * from reyes_letters')).rows.length,1);assert.equal((await db.query('select photo from reyes_wishes')).rows[0].photo,'data:image/jpeg;base64,YWJj');
 assert.equal((await db.query("update reyes_letters set message='Otro' returning id")).rows.length,0);
 assert.equal((await db.query('delete from reyes_wishes returning id')).rows.length,0);
 await assert.rejects(()=>db.query("insert into reyes_letters(family_id,owner_id,season,message) values($1,$2,2028,'Falso')",[family,ids[0]]),/row-level security/);
 await login(2);assert.equal((await db.query('select * from reyes_letters')).rows.length,0);assert.equal((await db.query('select * from reyes_wishes')).rows.length,0);
 await assert.rejects(()=>db.query("insert into reyes_wishes(family_id,owner_id,season,name) values($1,$2,2027,'Intruso')",[family,ids[2]]),/row-level security/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from reyes_wishes'),/permission denied/);
 await login(0);await db.query('delete from reyes_wishes where id=$1',[wish]);assert.equal((await db.query('select * from reyes_wishes')).rows.length,0);
 }finally{await db.close()}
});
