import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('Permisos reales de PostgreSQL: familias, privados e invitaciones',async()=>{const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;`);
await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
await db.query('insert into auth.users(id) values ($1),($2),($3)',[a,b,c]);
async function login(id,email){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",[id,email]);await db.exec('set role authenticated')}
await login(a,'ana@example.com');const fid=(await db.query("select public.create_family('Casa','Ana') as id")).rows[0].id;
const invite=(await db.query("select public.invite_member('bro@example.com','Hermano') as id")).rows[0].id;
await login(c,'outsider@example.com');await assert.rejects(()=>db.query('select public.join_family($1)',[invite]),/otro correo/);
const other=(await db.query("select public.create_family('Otra casa','Otro') as id")).rows[0].id;
await login(b,'bro@example.com');await db.query('select public.join_family($1)',[invite]);
const privateId=(await db.query("insert into public.items(family_id,owner_id,scope,kind,text) values($1,$2,'private','task','Deberes') returning id",[fid,b])).rows[0].id;
const sharedId=(await db.query("insert into public.items(family_id,owner_id,scope,kind,text) values($1,$2,'family','shopping','Pan') returning id",[fid,b])).rows[0].id;
await assert.rejects(()=>db.query("select public.invite_member('x@example.com','X')"),/administrador/);
await assert.rejects(()=>db.query("update public.profiles set role='admin' where id=$1",[b]),/permission denied/);
await login(a,'ana@example.com');assert.deepEqual((await db.query('select text from public.items')).rows.map(r=>r.text),['Pan']);
await assert.rejects(()=>db.query('select public.toggle_item($1)',[privateId]),/no disponible/);
await db.query('select public.toggle_item($1)',[sharedId]);assert.equal((await db.query('select done from public.items where id=$1',[sharedId])).rows[0].done,true);
assert.equal((await db.query('delete from public.items where id=$1 returning id',[sharedId])).rows.length,0);
await assert.rejects(()=>db.query("update public.items set scope='family' where id=$1",[privateId]),/permission denied/);
await assert.rejects(()=>db.query("insert into public.items(family_id,owner_id,scope,kind,text) values($1,$2,'family','task','Falso')",[fid,b]),/row-level security/);
await login(c,'outsider@example.com');assert.equal((await db.query('select * from public.items')).rows.length,0);
await assert.rejects(()=>db.query("insert into public.items(family_id,owner_id,scope,kind,text) values($1,$2,'family','task','Intruso')",[fid,c]),/row-level security/);
await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from public.items'),/permission denied/);
assert.ok(other);console.log('Privacidad entre miembros, aislamiento entre familias, invitaciones y permisos verificados.');
}finally{await db.close()}});
