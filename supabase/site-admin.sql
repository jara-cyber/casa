-- Ejecuta este archivo una vez en SQL Editor del proyecto existente.
-- No cambia roles de familia, usuarios, tareas ni contraseñas.
begin;
create table if not exists public.site_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from public,anon,authenticated;
create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.site_admins where user_id=auth.uid());
$$;
create or replace function public.site_admin_overview(p_view text default 'users',p_search text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total bigint;rows_json jsonb;skip integer;needle text;
begin
 if not public.is_site_admin() then raise exception 'Acceso reservado al propietario de la web' using errcode='42501';end if;
 if p_view not in ('users','families') or p_page is null or p_page<1 or p_page>100000 then raise exception 'Parámetros no válidos';end if;
 skip:=(p_page-1)*25;
 needle:='%'||replace(replace(replace(left(coalesce(p_search,''),100),'\','\\'),'%','\%'),'_','\_')||'%';
 if p_view='users' then
 select count(*) into total from auth.users u left join public.profiles p on p.id=u.id left join public.families f on f.id=p.family_id
 where u.email ilike needle or p.name ilike needle or f.name ilike needle;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_json from (
  select u.id,u.email,coalesce(p.name,'Sin perfil') as name,p.role,f.name as family_name,p.family_id,u.created_at,u.last_sign_in_at,(u.email_confirmed_at is not null) as confirmed
  from auth.users u left join public.profiles p on p.id=u.id left join public.families f on f.id=p.family_id
  where u.email ilike needle or p.name ilike needle or f.name ilike needle
  order by u.created_at desc,u.id offset skip limit 25
 ) q;
 else
 select count(*) into total from public.families f where f.name ilike needle or exists(select 1 from public.profiles p where p.family_id=f.id and (p.email ilike needle or p.name ilike needle));
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_json from (
  select f.id,f.name,(select count(*) from public.profiles p where p.family_id=f.id) as member_count,
  (select string_agg(p.email,', ' order by p.email) from public.profiles p where p.family_id=f.id and p.role='admin') as admins
  from public.families f where f.name ilike needle or exists(select 1 from public.profiles p where p.family_id=f.id and (p.email ilike needle or p.name ilike needle))
  order by f.name,f.id offset skip limit 25
 ) q;
 end if;
 return jsonb_build_object('view',p_view,'page',p_page,'pageSize',25,'total',total,'rows',rows_json,'stats',jsonb_build_object(
  'users',(select count(*) from auth.users),
  'signedIn',(select count(*) from auth.users where last_sign_in_at is not null),
  'families',(select count(*) from public.families)
 ));
end $$;
revoke all on function public.is_site_admin(),public.site_admin_overview(text,text,integer) from public,anon,authenticated;
grant execute on function public.is_site_admin(),public.site_admin_overview(text,text,integer) to authenticated;
commit;
-- Concede el acceso solo desde SQL Editor, sustituyendo el correo de ejemplo:
-- insert into public.site_admins(user_id)
-- select id from auth.users where lower(email)=lower('TU_CORREO_DE_CASA')
-- on conflict do nothing;
-- Comprueba que insertó exactamente una fila. No uses el nombre de la familia.
