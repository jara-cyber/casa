-- Ejecutar una vez en SQL Editor. Solo añade tablas del rincón de Reyes.
begin;
create table if not exists public.reyes_letters (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 season integer not null check(season between 2020 and 2200),
 message text not null default '' check(length(message)<=5000),
 unique(owner_id,season)
);
create table if not exists public.reyes_wishes (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 season integer not null check(season between 2020 and 2200),
 name text not null check(length(trim(name)) between 1 and 200),
 notes text not null default '' check(length(notes)<=1000),
 url text not null default '' check(length(url)<=2000 and (url='' or url ~* '^https?://')),
 photo text not null default '' check(length(photo)<=300000 and (photo='' or photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
 created_at timestamptz not null default now()
);
create index if not exists reyes_letters_family_season on public.reyes_letters(family_id,season);
create index if not exists reyes_wishes_family_season on public.reyes_wishes(family_id,season);
alter table public.reyes_letters enable row level security;
alter table public.reyes_wishes enable row level security;
do $$ declare t text; begin
 foreach t in array array['reyes_letters','reyes_wishes'] loop
 execute format('drop policy if exists reyes_read on public.%I',t);
 execute format('create policy reyes_read on public.%I for select to authenticated using(family_id=(select public.my_family()))',t);
 execute format('drop policy if exists reyes_insert on public.%I',t);
 execute format('create policy reyes_insert on public.%I for insert to authenticated with check(family_id=(select public.my_family()) and owner_id=(select auth.uid()))',t);
 execute format('drop policy if exists reyes_update on public.%I',t);
 execute format('create policy reyes_update on public.%I for update to authenticated using(family_id=(select public.my_family()) and owner_id=(select auth.uid())) with check(family_id=(select public.my_family()) and owner_id=(select auth.uid()))',t);
 execute format('drop policy if exists reyes_delete on public.%I',t);
 execute format('create policy reyes_delete on public.%I for delete to authenticated using(family_id=(select public.my_family()) and owner_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
commit;
