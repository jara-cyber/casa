-- Casa: ejecutar una vez en SQL Editor. No elimina datos.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.push_config (
 id boolean primary key default true check(id), public_key text not null, private_key text not null,
 dispatch_token text not null, contact text not null, function_url text not null,
 last_dispatch timestamptz
);
alter table public.push_config enable row level security;
revoke all on public.push_config from public, anon, authenticated;
grant all on public.push_config to service_role;
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now(), last_test timestamptz not null default 'epoch'
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
drop policy if exists push_own_read on public.push_subscriptions;
create policy push_own_read on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());
create table if not exists public.push_deliveries(
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 item_id uuid not null references public.items(id) on delete cascade, event_date text not null, reminder integer not null,
 attempts integer not null default 0, leased_until timestamptz, sent_at timestamptz,
 unique(subscription_id,item_id,event_date,reminder)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public,anon,authenticated;
grant all on public.push_deliveries to service_role;
create or replace function public.push_status() returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('publicKey',public_key,'lastDispatch',last_dispatch) from public.push_config where id), '{}'::jsonb)
$$;
create or replace function public.register_push(endpoint_value text,p256dh_value text,auth_value text) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_family() is null then raise exception 'Inicia sesión en tu familia'; end if;
 if not exists(select 1 from public.push_config) then raise exception 'El propietario debe activar el envío'; end if;
 if length(endpoint_value)>4096 or endpoint_value !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)/'
 or p256dh_value !~ '^[A-Za-z0-9_-]{87}=?$' or auth_value !~ '^[A-Za-z0-9_-]{22}={0,2}$'
 then raise exception 'Suscripción no válida o proveedor no compatible'; end if;
 if (select count(*) from public.push_subscriptions where user_id=auth.uid())>=10
 and not exists(select 1 from public.push_subscriptions where endpoint=endpoint_value and user_id=auth.uid())
 then raise exception 'Máximo 10 dispositivos. Elimina alguno antes de añadir otro'; end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(auth.uid(),endpoint_value,p256dh_value,auth_value)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where push_subscriptions.user_id=auth.uid();
 if not found then raise exception 'Este dispositivo está vinculado a otra cuenta. Desactiva sus avisos primero'; end if;
end $$;
create or replace function public.push_date(v text) returns timestamptz language plpgsql immutable set search_path='' as $$
begin return v::timestamptz; exception when others then return null; end $$;
create or replace function public.claim_push() returns table(delivery_id uuid, endpoint text,p256dh text,auth text) language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('casa-push-claim'));
 insert into public.push_deliveries(subscription_id,item_id,event_date,reminder)
 select s.id,i.id,i.date,i.reminder from public.items i
 join public.profiles p on p.family_id=i.family_id and (i.scope='family' or i.owner_id=p.id)
 join public.push_subscriptions s on s.user_id=p.id
 where i.kind='event' and not i.done and public.push_date(i.date)>=now()
 and public.push_date(i.date)-make_interval(mins=>i.reminder)<=now()
 and public.push_date(i.date)-make_interval(mins=>i.reminder)>=now()-interval '24 hours'
 on conflict do nothing;
 -- El servidor solo recibe suscripciones autorizadas para una cita todavía vigente.
 return query with picked as (
 select d.id from public.push_deliveries d
 join public.items i on i.id=d.item_id and i.date=d.event_date and i.reminder=d.reminder and not i.done and i.kind='event'
 join public.push_subscriptions s on s.id=d.subscription_id
 join public.profiles p on p.id=s.user_id and p.family_id=i.family_id and (i.scope='family' or i.owner_id=p.id)
 where d.sent_at is null and d.attempts<5 and (d.leased_until is null or d.leased_until<now())
 and public.push_date(i.date)>=now() order by d.id limit 10 for update of d skip locked
 ), claimed as (
 update public.push_deliveries d set attempts=d.attempts+1, leased_until=now()+interval '5 minutes'
 from picked where d.id=picked.id returning d.id,d.subscription_id
 ) select c.id,s.endpoint,s.p256dh,s.auth from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
end $$;
create or replace function public.dispatch_casa_push() returns void language plpgsql security definer set search_path='' as $$
declare c public.push_config;
begin
 select * into c from public.push_config where id;
 if not found then return; end if;
 perform net.http_post(url:=c.function_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.dispatch_token),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
end $$;
revoke all on function public.push_date(text),public.claim_push(),public.dispatch_casa_push(),public.push_status(),public.register_push(text,text,text) from public,anon,authenticated;
grant execute on function public.push_status(),public.register_push(text,text,text) to authenticated;
grant execute on function public.claim_push() to service_role;
select cron.schedule('casa-push-every-minute','* * * * *','select public.dispatch_casa_push()');
commit;
