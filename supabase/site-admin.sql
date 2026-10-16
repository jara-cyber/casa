-- Ejecuta este archivo una vez en SQL Editor del proyecto existente.
-- Instala permisos y operaciones. Ejecutarlo no elimina usuarios ni familias.
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
  select u.id,u.email,exists(select 1 from public.site_admins sa where sa.user_id=u.id) as protected,coalesce(p.name,'Sin perfil') as name,p.role,f.name as family_name,p.family_id,u.created_at,u.last_sign_in_at,(u.email_confirmed_at is not null) as confirmed
  from auth.users u left join public.profiles p on p.id=u.id left join public.families f on f.id=p.family_id
  where u.email ilike needle or p.name ilike needle or f.name ilike needle
  order by u.created_at desc,u.id offset skip limit 25
 ) q;
 else
 select count(*) into total from public.families f where f.name ilike needle or exists(select 1 from public.profiles p where p.family_id=f.id and (p.email ilike needle or p.name ilike needle));
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_json from (
  select f.id,f.name,exists(select 1 from public.site_admins sa join public.profiles sp on sp.id=sa.user_id where sp.family_id=f.id) as protected,(select count(*) from public.profiles p where p.family_id=f.id) as member_count,
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
create or replace function public.site_admin_delete_user(p_user_id uuid,p_confirm_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_email text;target_family uuid;target_role text;
begin
 if not public.is_site_admin() then raise exception 'Acceso reservado al propietario de la web' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('casa.site-admin.delete'));
 if p_user_id=auth.uid() or exists(select 1 from public.site_admins where user_id=p_user_id) then raise exception 'No se puede eliminar una cuenta propietaria';end if;
 select email into target_email from auth.users where id=p_user_id for update;
 if not found then raise exception 'La cuenta ya no existe';end if;
 if p_confirm_email is distinct from target_email then raise exception 'El correo de confirmación no coincide';end if;
 select family_id,role into target_family,target_role from public.profiles where id=p_user_id;
 if target_family is not null then
  perform 1 from public.families where id=target_family for update;
  if target_role='admin' and exists(select 1 from public.profiles where family_id=target_family and id<>p_user_id) and not exists(select 1 from public.profiles where family_id=target_family and role='admin' and id<>p_user_id) then
   raise exception 'Es el único administrador de esa familia. Elimina la familia completa o asigna antes otro administrador desde Supabase';
  end if;
 end if;
 delete from public.items where owner_id=p_user_id;
 delete from public.family_invites where lower(email)=lower(target_email);
 delete from public.profiles where id=p_user_id;
 delete from auth.users where id=p_user_id;
 if target_family is not null and not exists(select 1 from public.profiles where family_id=target_family) then
  delete from public.items where family_id=target_family;
  delete from public.family_invites where family_id=target_family;
  delete from public.families where id=target_family;
 end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.site_admin_delete_family(p_family_id uuid,p_confirmation text,p_expected_members integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_name text;member_ids uuid[];member_total integer;
begin
 if not public.is_site_admin() then raise exception 'Acceso reservado al propietario de la web' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('casa.site-admin.delete'));
 select name into target_name from public.families where id=p_family_id for update;
 if not found then raise exception 'La familia ya no existe';end if;
 if p_confirmation is distinct from ('ELIMINAR '||target_name) then raise exception 'La confirmación no coincide';end if;
 if exists(select 1 from public.site_admins sa join public.profiles p on p.id=sa.user_id where p.family_id=p_family_id) then raise exception 'No se puede eliminar una familia que contiene una cuenta propietaria';end if;
 perform 1 from public.profiles where family_id=p_family_id for update;
 select coalesce(array_agg(id),array[]::uuid[]),count(*) into member_ids,member_total from public.profiles where family_id=p_family_id;
 if p_expected_members is distinct from member_total then raise exception 'Los miembros han cambiado. Actualiza la lista y vuelve a confirmar';end if;
 delete from public.family_invites where family_id=p_family_id or lower(email) in (select lower(email) from public.profiles where id=any(member_ids));
 delete from public.items where family_id=p_family_id or owner_id=any(member_ids);
 delete from public.profiles where family_id=p_family_id;
 delete from auth.users where id=any(member_ids);
 delete from public.families where id=p_family_id;
 return jsonb_build_object('ok',true,'deletedUsers',member_total);
end $$;
revoke all on function public.is_site_admin(),public.site_admin_overview(text,text,integer),public.site_admin_delete_user(uuid,text),public.site_admin_delete_family(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.is_site_admin(),public.site_admin_overview(text,text,integer),public.site_admin_delete_user(uuid,text),public.site_admin_delete_family(uuid,text,integer) to authenticated;
commit;
-- El permiso de propietario se asigna únicamente desde SQL Editor.
-- No hay ninguna RPC para que una cuenta pueda concederse este permiso.
