-- Casa: activar avisos al poner o cambiar una reacción.
-- Incluye reacciones y actividad. Requiere push.sql ya instalado. No borra datos.
begin;
-- Ejecutar una sola vez en SQL Editor del proyecto Casa. No elimina datos.
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

-- Actualización para proyectos que ya tienen push.sql instalado.
-- No elimina cuentas, datos ni suscripciones.
create table if not exists public.push_activity_deliveries(
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 item_id uuid not null references public.items(id) on delete cascade,
 created_at timestamptz not null default now(),
 attempts integer not null default 0,leased_until timestamptz,sent_at timestamptz,
 unique(subscription_id,item_id)
);
alter table public.push_activity_deliveries enable row level security;
revoke all on public.push_activity_deliveries from public,anon,authenticated;
grant all on public.push_activity_deliveries to service_role;
create or replace function public.queue_shared_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.scope<>'family' then return new;end if;
 insert into public.push_activity_deliveries(subscription_id,item_id)
 select s.id,new.id from public.push_subscriptions s
 join public.profiles p on p.id=s.user_id and p.family_id=new.family_id
 on conflict do nothing;
 -- pg_net realiza la petición de forma asíncrona después de confirmar la transacción.
 -- El cron existente recupera fallos temporales sin bloquear la creación de registros.
 begin
  perform public.dispatch_casa_push();
 exception when others then null;
 end;
 return new;
end $$;
drop trigger if exists casa_shared_activity on public.items;
create trigger casa_shared_activity after insert on public.items for each row execute function public.queue_shared_activity();
create or replace function public.claim_activity_push()
returns table(delivery_id uuid,endpoint text,p256dh text,auth text,body text)
language plpgsql security definer set search_path='' as $$
begin
 return query with picked as (
 select d.id from public.push_activity_deliveries d
 join public.items i on i.id=d.item_id and i.scope='family'
 join public.push_subscriptions s on s.id=d.subscription_id
 join public.profiles p on p.id=s.user_id and p.family_id=i.family_id
 where d.sent_at is null and d.attempts<5
 and d.created_at>now()-interval '24 hours'
 and (d.leased_until is null or d.leased_until<now())
 order by d.created_at,d.id limit 10 for update of d skip locked
 ), claimed as (
 update public.push_activity_deliveries d set attempts=d.attempts+1,leased_until=now()+interval '5 minutes'
 from picked where d.id=picked.id returning d.id,d.subscription_id,d.item_id
 )
 select c.id,s.endpoint,s.p256dh,s.auth,
 (case i.kind when 'task' then 'Nueva tarea'
 when 'event' then 'Nueva cita' when 'shopping' then 'Nuevo producto en la compra'
 when 'meal' then 'Nuevo plato en el menú' when 'expense' then 'Nuevo gasto'
 when 'link' then 'Nuevo enlace' else 'Nuevo registro' end)
 ||' de '||left(author.name,80)||'. Abre Casa para verlo.'
 from claimed c join public.push_subscriptions s on s.id=c.subscription_id
 join public.items i on i.id=c.item_id join public.profiles author on author.id=i.owner_id;
end $$;
revoke all on function public.queue_shared_activity(),public.claim_activity_push() from public,anon,authenticated;
grant execute on function public.claim_activity_push() to service_role;
create or replace function public.dispatch_casa_push() returns void language plpgsql security definer set search_path='' as $$
declare c public.push_config;
begin
 select * into c from public.push_config where id;
 if not found then return;end if;
 perform net.http_post(url:=c.function_url,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.dispatch_token),
 body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.dispatch_casa_push() from public,anon,authenticated;

-- Añade notificaciones de reacciones a la cola que ya utiliza casa-push.
alter table public.task_reactions add column if not exists notification_version uuid not null default gen_random_uuid();
alter table public.push_activity_deliveries add column if not exists activity_type text not null default 'created';
alter table public.push_activity_deliveries add column if not exists actor_id uuid references public.profiles(id) on delete cascade;
alter table public.push_activity_deliveries add column if not exists reaction text;
alter table public.push_activity_deliveries add column if not exists event_key text not null default 'created';
alter table public.push_activity_deliveries drop constraint if exists push_activity_deliveries_subscription_id_item_id_key;
create unique index if not exists push_activity_event_unique on public.push_activity_deliveries(subscription_id,item_id,event_key);
create or replace function public.version_task_reaction() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.notification_version:=gen_random_uuid();
 elsif new.reaction is distinct from old.reaction then new.notification_version:=gen_random_uuid();
 else new.notification_version:=old.notification_version;
 end if;
 return new;
end $$;
drop trigger if exists casa_reaction_version on public.task_reactions;
create trigger casa_reaction_version before insert or update on public.task_reactions for each row execute function public.version_task_reaction();
create or replace function public.queue_reaction_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare family uuid;
begin
 if tg_op='UPDATE' then
  if new.reaction is not distinct from old.reaction then return new;end if;
 end if;
 select i.family_id into family from public.items i join public.profiles actor on actor.id=new.user_id and actor.family_id=i.family_id
 where i.id=new.task_id and i.kind='task' and i.scope='family';
 if not found then return new;end if;
 insert into public.push_activity_deliveries(subscription_id,item_id,activity_type,actor_id,reaction,event_key)
 select s.id,new.task_id,'reaction',new.user_id,new.reaction,new.notification_version::text
 from public.push_subscriptions s join public.profiles p on p.id=s.user_id and p.family_id=family
 on conflict do nothing;
 begin perform public.dispatch_casa_push();exception when others then null;end;
 return new;
end $$;
drop trigger if exists casa_reaction_activity on public.task_reactions;
create trigger casa_reaction_activity after insert or update of reaction on public.task_reactions for each row execute function public.queue_reaction_activity();
create or replace function public.claim_activity_push()
returns table(delivery_id uuid,endpoint text,p256dh text,auth text,body text)
language plpgsql security definer set search_path='' as $$
begin
 return query with picked as (
 select d.id from public.push_activity_deliveries d
 join public.items i on i.id=d.item_id and i.scope='family'
 join public.push_subscriptions s on s.id=d.subscription_id
 join public.profiles p on p.id=s.user_id and p.family_id=i.family_id
 where d.sent_at is null and d.attempts<5 and d.created_at>now()-interval '24 hours'
 and (d.leased_until is null or d.leased_until<now())
 and (d.activity_type='created' or
  (d.activity_type='reaction' and i.kind='task' and exists(
   select 1 from public.task_reactions r join public.profiles actor on actor.id=r.user_id and actor.family_id=i.family_id
   where r.task_id=i.id and r.user_id=d.actor_id and r.reaction=d.reaction and r.notification_version::text=d.event_key
  )))
 order by d.created_at,d.id limit 10 for update of d skip locked
 ), claimed as (
 update public.push_activity_deliveries d set attempts=d.attempts+1,leased_until=now()+interval '5 minutes'
 from picked where d.id=picked.id returning d.id,d.subscription_id,d.item_id,d.activity_type,d.actor_id,d.reaction
 )
 select c.id,s.endpoint,s.p256dh,s.auth,
 case when c.activity_type='reaction' then left(reactor.name,80)||': '||
 (case c.reaction when 'seen' then '✓ Visto' when 'perfect' then '👌 Perfecto' when 'volunteer' then '🙋 Lo hago yo' end)
 ||' en una tarea compartida. Abre Casa para verla.'
 else (case i.kind when 'task' then 'Nueva tarea' when 'event' then 'Nueva cita'
 when 'shopping' then 'Nuevo producto en la compra' when 'meal' then 'Nuevo plato en el menú'
 when 'expense' then 'Nuevo gasto' when 'link' then 'Nuevo enlace' else 'Nuevo registro' end)
 ||' de '||left(author.name,80)||'. Abre Casa para verlo.' end
 from claimed c join public.push_subscriptions s on s.id=c.subscription_id
 join public.items i on i.id=c.item_id join public.profiles author on author.id=i.owner_id
 left join public.profiles reactor on reactor.id=c.actor_id;
end $$;
revoke all on function public.version_task_reaction(),public.queue_reaction_activity(),public.claim_activity_push() from public,anon,authenticated;
grant execute on function public.claim_activity_push() to service_role;

commit;
