-- Actualización para proyectos que ya tienen push.sql instalado.
-- No elimina cuentas, datos ni suscripciones.
begin;
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
commit;
