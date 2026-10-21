import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('Reacciones: identidad, privacidad, cambio y eliminación',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;
 grant usage on schema auth,public to authenticated,anon,service_role;`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../supabase/task-reactions.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
 await db.query('insert into auth.users values($1),($2),($3)',ids);
 async function login(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",[ids[n],n+'@example.org']);await db.exec('set role authenticated')}
 await login(0);const family=(await db.query("select create_family('Familia A','Ana') id")).rows[0].id;
 const invite=(await db.query("select invite_member('1@example.org','Luis') id")).rows[0].id;
 await login(1);await db.query('select join_family($1)',[invite]);
 await login(2);await db.query("select create_family('Familia B','Otra')");
 await login(0);
 async function item(scope,kind){return (await db.query('insert into items(family_id,owner_id,scope,kind,text) values($1,$2,$3,$4,$5) returning id',[family,ids[0],scope,kind,'Sacar al perro'])).rows[0].id}
 const shared=await item('family','task'),privateTask=await item('private','task'),shopping=await item('family','shopping');
 await db.query('select react_to_task($1,$2)',[shared,'seen']);
 assert.equal((await db.query('select * from task_reactions')).rows[0].user_id,ids[0]);
 await assert.rejects(()=>db.query('select react_to_task($1,$2)',[privateTask,'seen']),/no está disponible/);
 await assert.rejects(()=>db.query('select react_to_task($1,$2)',[shopping,'seen']),/no está disponible/);
 await assert.rejects(()=>db.query('select react_to_task($1,$2)',[shared,'admin']),/no válida/);
 await login(1);
 await db.query('select react_to_task($1,$2)',[shared,'perfect']);
 assert.equal((await db.query('select * from task_reactions')).rows.length,2);
 await assert.rejects(()=>db.query('insert into task_reactions(task_id,user_id,reaction) values($1,$2,$3)',[shared,ids[0],'volunteer']),/permission denied/);
 await assert.rejects(()=>db.query("update task_reactions set reaction='volunteer' where user_id=$1",[ids[0]]),/permission denied/);
 // Elegir otra opción reemplaza solo la propia; repetirla la quita.
 await db.query('select react_to_task($1,$2)',[shared,'volunteer']);
 assert.equal((await db.query('select reaction from task_reactions where user_id=$1',[ids[1]])).rows[0].reaction,'volunteer');
 await db.query('select react_to_task($1,$2)',[shared,'volunteer']);
 assert.equal((await db.query('select * from task_reactions')).rows.length,1);
 await db.query('select react_to_task($1,$2)',[shared,'seen']);
 await login(2);
 assert.equal((await db.query('select * from task_reactions')).rows.length,0);
 await assert.rejects(()=>db.query('select react_to_task($1,$2)',[shared,'perfect']),/no está disponible/);
 await db.exec('reset role;set role anon');
 await assert.rejects(()=>db.query('select * from task_reactions'),/permission denied/);
 await assert.rejects(()=>db.query('select react_to_task($1,$2)',[shared,'perfect']),/permission denied/);
 await login(0);await db.query('delete from items where id=$1',[shared]);
 assert.equal((await db.query('select * from task_reactions')).rows.length,0);
 }finally{await db.close()}
});
