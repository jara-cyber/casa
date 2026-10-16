-- Ejecutar una vez en un proyecto Supabase nuevo, desde SQL Editor.
begin;
create table public.families(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80));
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,family_id uuid not null references public.families(id),name text not null check(length(name) between 1 and 80),email text not null,role text not null check(role in ('admin','member')));
create index profiles_family_idx on public.profiles(family_id);
create table public.family_invites(id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families(id),email text not null,name text not null,expires_at timestamptz not null default now()+interval '7 days',used_at timestamptz);
create table public.items(id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families(id),owner_id uuid not null references public.profiles(id),scope text not null check(scope in ('private','family')),kind text not null check(kind in ('task','shopping','event','expense','meal','link')),text text not null check(length(text) between 1 and 500),date text not null default '',amount integer not null default 0 check(amount>=0),done boolean not null default false,reminder integer not null default 1440 check(reminder in (0,30,60,1440)),extra text not null default '' check(length(extra)<=1000),created_at timestamptz not null default now());
create index items_family_idx on public.items(family_id);
create index items_owner_idx on public.items(owner_id);
alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.family_invites enable row level security;
alter table public.items enable row level security;
create function public.my_family() returns uuid language sql stable security definer set search_path='' as $$select family_id from public.profiles where id=(select auth.uid())$$;
create function public.is_family_admin() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select role='admin' from public.profiles where id=(select auth.uid())),false)$$;
create policy family_read on public.families for select to authenticated using(id=(select public.my_family()));
create policy profile_read on public.profiles for select to authenticated using(family_id=(select public.my_family()));
create policy invite_read on public.family_invites for select to authenticated using(family_id=(select public.my_family()) and (select public.is_family_admin()));
create policy item_read on public.items for select to authenticated using(family_id=(select public.my_family()) and (scope='family' or owner_id=(select auth.uid())));
create policy item_insert on public.items for insert to authenticated with check(family_id=(select public.my_family()) and owner_id=(select auth.uid()));
create policy item_delete on public.items for delete to authenticated using(family_id=(select public.my_family()) and owner_id=(select auth.uid()));
-- No hay UPDATE directo: la función permite cambiar únicamente done.
create function public.create_family(family_name text,display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare fid uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Ya perteneces a una familia';end if;
 insert into public.families(name) values(trim(family_name)) returning id into fid;
 insert into public.profiles(id,family_id,name,email,role) values(auth.uid(),fid,trim(display_name),lower(auth.jwt()->>'email'),'admin');
 return fid;
end $$;
create function public.invite_member(member_email text,member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare code uuid;
begin
 if not public.is_family_admin() then raise exception 'Solo el administrador puede invitar';end if;
 if length(member_name) not between 1 and 80 or member_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisa nombre y correo';end if;
 insert into public.family_invites(family_id,email,name) values(public.my_family(),lower(trim(member_email)),trim(member_name)) returning id into code;return code;
end $$;
create function public.join_family(invite_code uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.family_invites;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Ya perteneces a una familia';end if;
 select * into invitation from public.family_invites where id=invite_code and used_at is null and expires_at>now() and email=lower(auth.jwt()->>'email') for update;
 if not found then raise exception 'Código caducado, utilizado o destinado a otro correo';end if;
 insert into public.profiles(id,family_id,name,email,role) values(auth.uid(),invitation.family_id,invitation.name,invitation.email,'member');
 update public.family_invites set used_at=now() where id=invitation.id;return invitation.family_id;
end $$;
create function public.toggle_item(item_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.items set done=not done where id=item_id and family_id=public.my_family() and kind in ('task','shopping') and (owner_id=auth.uid() or scope='family');
 if not found then raise exception 'Registro no disponible';end if;
end $$;
revoke all on public.families,public.profiles,public.family_invites,public.items from anon,authenticated;
grant select on public.families,public.profiles,public.family_invites to authenticated;
grant select,insert,delete on public.items to authenticated;
revoke all on function public.my_family(),public.is_family_admin(),public.create_family(text,text),public.invite_member(text,text),public.join_family(uuid),public.toggle_item(uuid) from public,anon;
grant execute on function public.my_family(),public.is_family_admin(),public.create_family(text,text),public.invite_member(text,text),public.join_family(uuid),public.toggle_item(uuid) to authenticated;
commit;
