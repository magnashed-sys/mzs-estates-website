begin;
create table public.mzs_intro_call_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email !~ '[[:space:]]' and email like '%@%.%'),
  phone text not null default '' check (char_length(phone) <= 40),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index mzs_intro_call_requests_created_idx on public.mzs_intro_call_requests(created_at desc);
alter table public.mzs_intro_call_requests enable row level security;
revoke all on public.mzs_intro_call_requests from public, anon, authenticated;
grant select, insert, update on public.mzs_intro_call_requests to service_role;
grant select on public.mzs_intro_call_requests to authenticated;
grant update(status) on public.mzs_intro_call_requests to authenticated;
create policy intro_calls_admin_read on public.mzs_intro_call_requests for select to authenticated
  using ((select public.is_admin()));
create policy intro_calls_admin_update on public.mzs_intro_call_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.mzs_intro_call_timestamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;
revoke all on function public.mzs_intro_call_timestamp() from public, anon, authenticated;
create trigger mzs_intro_call_updated before update on public.mzs_intro_call_requests
  for each row execute function public.mzs_intro_call_timestamp();

alter table public.mzs_mail_outbox drop constraint mzs_mail_outbox_event_type_check;
alter table public.mzs_mail_outbox add constraint mzs_mail_outbox_event_type_check check
  (event_type in ('application_received','account_activated','new_project_access','capital_access_granted','intro_call_requested'));

-- Service-role only: the public API validates, rate-limits and checks environment
-- before calling. Saving the lead and administrative notifications is atomic.
create function public.mzs_submit_intro_call(p_request_key uuid,p_name text,p_email text,p_phone text,p_message text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_request public.mzs_intro_call_requests; v_events jsonb;
begin
  if p_request_key is null or p_name is null or char_length(btrim(p_name)) not between 1 and 120
     or p_email is null or char_length(p_email) not between 3 and 254 or p_email ~ '[[:space:]]' or p_email not like '%@%.%'
     or p_phone is null or char_length(p_phone)>40 or p_message is null or char_length(p_message)>1000
     or p_name ~ E'[\r\n]' or p_phone ~ E'[\r\n]' then
    raise exception 'Invalid enquiry' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,1));
  select * into v_request from public.mzs_intro_call_requests where request_key=p_request_key;
  if found then
    if v_request.email<>lower(p_email) or v_request.full_name<>btrim(p_name)
       or v_request.phone<>p_phone or v_request.message<>p_message then
      raise exception 'Request key already used' using errcode='22023';
    end if;
  else
    if not exists(select 1 from public.profiles where role='admin' and is_active=true and email is not null and email like '%@%.%') then
      raise exception 'No notification recipient configured';
    end if;
    insert into public.mzs_intro_call_requests(request_key,full_name,email,phone,message)
      values(p_request_key,btrim(p_name),lower(p_email),p_phone,p_message) returning * into v_request;
    insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
      select p.id,'intro_call_requested',jsonb_build_object('request_id',v_request.id),
        'intro_call:'||v_request.id::text||':'||p.id::text
      from public.profiles p where p.role='admin' and p.is_active=true and p.email is not null and p.email like '%@%.%';
  end if;
  select coalesce(jsonb_agg(id),'[]'::jsonb) into v_events from public.mzs_mail_outbox
    where event_type='intro_call_requested' and payload->>'request_id'=v_request.id::text and status='pending';
  return jsonb_build_object('id',v_request.id,'events',v_events);
end $$;
revoke all on function public.mzs_submit_intro_call(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mzs_submit_intro_call(uuid,text,text,text,text) to service_role;
commit;
