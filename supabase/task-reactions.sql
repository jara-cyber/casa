-- Ejecutar una sola vez en SQL Editor del proyecto Casa. No elimina datos.
begin;
create table if not exists public.task_reactions(
 task_id uuid not null references public.items(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(reaction in ('seen','perfect','volunteer')),
 updated_at timestamptz not null default now(),
 primary key(task_id,user_id)
);
alter table public.task_reactions enable row level security;
revoke all on public.task_reactions from public,anon,authenticated;
grant select on public.task_reactions to authenticated;
grant all on public.task_reactions to service_role;
drop policy if exists task_reactions_read on public.task_reactions;
create policy task_reactions_read on public.task_reactions for select to authenticated using(
 exists(select 1 from public.items i join public.profiles p on p.id=task_reactions.user_id and p.family_id=i.family_id
 where i.id=task_reactions.task_id and i.kind='task' and i.scope='family' and i.family_id=public.my_family())
);
create or replace function public.react_to_task(p_task_id uuid,p_reaction text)
returns void language plpgsql security definer set search_path='' as $$
declare target public.items;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if p_reaction is not null and p_reaction not in ('seen','perfect','volunteer') then raise exception 'Reacción no válida';end if;
 select * into target from public.items where id=p_task_id and kind='task' and scope='family' and family_id=public.my_family() for share;
 if not found then raise exception 'La tarea no está disponible para tu familia';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_task_id::text));
 if p_reaction is null then
  delete from public.task_reactions where task_id=p_task_id and user_id=auth.uid();return;
 end if;
 delete from public.task_reactions where task_id=p_task_id and user_id=auth.uid() and reaction=p_reaction;
 if found then return;end if;
 insert into public.task_reactions(task_id,user_id,reaction) values(p_task_id,auth.uid(),p_reaction)
 on conflict(task_id,user_id) do update set reaction=excluded.reaction,updated_at=now();
end $$;
revoke all on function public.react_to_task(uuid,text) from public,anon,authenticated;
grant execute on function public.react_to_task(uuid,text) to authenticated;
commit;
