-- MZS Group: self-registration + verified activation + durable mail queue.
-- REVIEW BEFORE APPLYING TO PRODUCTION. Existing invitation flow is preserved.
-- Apply before merging the companion Next.js deployment.
begin;

alter table public.access_requests
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email_verified_at timestamptz;
create unique index if not exists mzs_access_request_auth_user_unique
  on public.access_requests(auth_user_id);

alter table public.profiles add column if not exists email_normalized text
  generated always as (lower(btrim(email))) stored;
create unique index if not exists mzs_profiles_email_normalized_unique
  on public.profiles(email_normalized);

create table if not exists public.mzs_registration_attempts (
  id bigint generated always as identity primary key,
  bucket text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists mzs_registration_attempts_bucket_idx
  on public.mzs_registration_attempts(bucket,occurred_at desc);
alter table public.mzs_registration_attempts enable row level security;
revoke all on public.mzs_registration_attempts from anon, authenticated;

create or replace function public.mzs_check_registration_rate(
  p_bucket text,p_limit integer,p_window_seconds integer
) returns boolean language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
  if p_bucket is null or length(p_bucket)>160 or length(p_bucket)<20
    or p_limit not between 1 and 20 or p_window_seconds not between 60 and 86400
  then raise exception 'Invalid registration rate limit input' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_bucket,0));
  delete from public.mzs_registration_attempts where occurred_at < now()-interval '2 days';
  select count(*) into n from public.mzs_registration_attempts
    where bucket=p_bucket and occurred_at>now()-make_interval(secs=>p_window_seconds);
  if n>=p_limit then return false; end if;
  insert into public.mzs_registration_attempts(bucket) values(p_bucket);
  return true;
end $$;
revoke all on function public.mzs_check_registration_rate(text,integer,integer) from public,anon,authenticated;
grant execute on function public.mzs_check_registration_rate(text,integer,integer) to service_role;

create table if not exists public.mzs_mail_outbox(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check(event_type in ('application_received','account_activated','new_project_access')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index if not exists mzs_mail_outbox_queue_idx
  on public.mzs_mail_outbox(status,next_attempt_at,created_at);
alter table public.mzs_mail_outbox enable row level security;
revoke all on public.mzs_mail_outbox from anon, authenticated;

-- Claim exactly one due email, even if multiple workers request delivery concurrently.
create or replace function public.mzs_claim_outbox(p_id uuid default null)
returns setof public.mzs_mail_outbox language plpgsql security definer set search_path=''
as $$
begin
  return query
  with candidate as (
    select q.id from public.mzs_mail_outbox q
    where (p_id is null or q.id=p_id)
      and q.attempts<6
      and (
        (q.status='pending' and q.next_attempt_at<=now())
        or (q.status='sending' and q.locked_at<now()-interval '10 minutes')
      )
    order by q.created_at
    for update skip locked limit 1
  )
  update public.mzs_mail_outbox q set status='sending',
    attempts=q.attempts+1,locked_at=now(),last_error=null
  from candidate c where q.id=c.id returning q.*;
end $$;
revoke all on function public.mzs_claim_outbox(uuid) from public,anon,authenticated;
grant execute on function public.mzs_claim_outbox(uuid) to service_role;

-- Existing signup trigger already creates inactive profiles. Extend it to
-- atomically record new-style applications; legacy invite users remain unchanged.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_data jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
  v_name text;
  v_interests public.offering_type[];
begin
  v_name := coalesce(nullif(btrim(v_data->>'full_name'),''),split_part(coalesce(new.email,''),'@',1),'Client');
  insert into public.profiles(id,role,full_name,email,is_active)
  values(new.id,'client'::public.user_role,v_name,coalesce(new.email,''),false)
  on conflict(id) do nothing;

  if v_data->>'mzs_access_request'='v2' then
    select coalesce(array_agg(choice.value::public.offering_type),array[]::public.offering_type[])
      into v_interests
    from jsonb_array_elements_text(
      case when jsonb_typeof(v_data->'interests')='array' then v_data->'interests'
      else '[]'::jsonb end
    ) as choice(value)
    where choice.value in ('rental','sale','investment','financing');
    insert into public.access_requests(
      auth_user_id,full_name,email,company,country,interests,message,status,email_verified_at
    ) values(
      new.id, left(v_name,120),new.email,
      nullif(left(btrim(coalesce(v_data->>'company','')),120),''),
      nullif(left(btrim(coalesce(v_data->>'country','')),100),''),
      v_interests,
      nullif(left(btrim(coalesce(v_data->>'message','')),2000),''),
      'pending',new.email_confirmed_at
    ) on conflict(auth_user_id) do nothing;

    -- Staff notification is queued inside the same signup transaction.
    insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
    select p.id,'application_received',jsonb_build_object('requester',v_name),
      'application:'||new.id::text||':'||p.id::text
    from public.profiles p where p.role='admin' and p.is_active=true
    on conflict(idempotency_key) do nothing;
  end if;
  return new;
end $$;

create or replace function public.mzs_mark_verified_application()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.email_confirmed_at is not null
     and old.email_confirmed_at is distinct from new.email_confirmed_at then
    update public.access_requests set email_verified_at=new.email_confirmed_at
      where auth_user_id=new.id and email_verified_at is null;
  end if;
  return new;
end $$;
drop trigger if exists mzs_auth_email_verified on auth.users;
create trigger mzs_auth_email_verified
after update of email_confirmed_at on auth.users
for each row execute function public.mzs_mark_verified_application();

-- Approve a verified, pre-existing, inactive account and attach explicit grants
-- atomically. Old requests (auth_user_id IS NULL) keep the legacy invitation workflow.
create or replace function public.approve_mzs_registered_request(
  p_request_id uuid,p_role text,p_offering_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=(select auth.uid());
  v_request public.access_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_offerings uuid[];
  v_n integer;
  v_titles jsonb;
  v_event uuid;
begin
  if v_admin is null or (select public.is_admin()) is not true then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_request_id is null or p_role not in ('client','partner')
     or p_offering_ids is null or cardinality(p_offering_ids) not between 1 and 100
     or array_ndims(p_offering_ids)>1 or array_position(p_offering_ids,null) is not null then
    raise exception 'Invalid approval input' using errcode='22023';
  end if;
  select * into v_request from public.access_requests
    where id=p_request_id for update;
  if not found or v_request.status<>'pending' or v_request.auth_user_id is null then
    raise exception 'Registration is not pending' using errcode='22023';
  end if;
  select * into v_profile from public.profiles
    where id=v_request.auth_user_id for update;
  if not found or v_profile.is_active or v_profile.role not in ('client','partner')
    or lower(btrim(v_profile.email))<>lower(btrim(v_request.email)) then
    raise exception 'Account is not eligible' using errcode='42501';
  end if;
  if not exists(
    select 1 from auth.users u
    where u.id=v_request.auth_user_id
      and u.email_confirmed_at is not null
      and lower(btrim(u.email))=lower(btrim(v_request.email))
  ) then raise exception 'Email verification is still required' using errcode='42501';
  end if;
  select coalesce(array_agg(distinct x order by x),array[]::uuid[]) into v_offerings
    from unnest(p_offering_ids) as x;
  select count(*) into v_n from public.offerings o
    join public.projects p on p.id=o.project_id
    where o.id=any(v_offerings) and o.status='active' and p.status='active';
  if v_n<>cardinality(v_offerings) then
    raise exception 'An assigned opportunity is unavailable' using errcode='22023';
  end if;

  update public.profiles set role=p_role::public.user_role,is_active=true
    where id=v_request.auth_user_id;
  insert into public.project_access(user_id,project_id)
    select distinct v_request.auth_user_id,o.project_id from public.offerings o
    where o.id=any(v_offerings) on conflict do nothing;
  insert into public.offering_access(user_id,offering_id)
    select v_request.auth_user_id,unnest(v_offerings) on conflict do nothing;
  insert into public.access_request_access_plans(
    request_id,requested_role,revision,approved_by,approved_at,applied_user_id,applied_at
  ) values(
    v_request.id,p_role::public.user_role,1,v_admin,now(),v_request.auth_user_id,now()
  ) on conflict(request_id) do update
    set requested_role=excluded.requested_role, revision=public.access_request_access_plans.revision+1,
      approved_by=excluded.approved_by,approved_at=excluded.approved_at,
      applied_user_id=excluded.applied_user_id,applied_at=excluded.applied_at;
  insert into public.access_request_offering_plans(request_id,offering_id)
    select v_request.id,unnest(v_offerings) on conflict do nothing;
  update public.access_requests set status='approved',reviewed_at=now() where id=v_request.id;

  select coalesce(jsonb_agg(distinct p.title),'[]'::jsonb) into v_titles
    from public.projects p join public.offerings o on o.project_id=p.id
    where o.id=any(v_offerings);
  insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
    values(v_request.auth_user_id,'account_activated',
      jsonb_build_object('projects',v_titles),
      'activation:'||v_request.id::text)
    on conflict(idempotency_key) do nothing;
  select id into v_event from public.mzs_mail_outbox
    where idempotency_key='activation:'||v_request.id::text;
  return jsonb_build_object('ok',true,'request_id',v_request.id,'mail_event_id',v_event,
     'email_verified',true,'project_count',jsonb_array_length(v_titles));
end $$;
revoke all on function public.approve_mzs_registered_request(uuid,text,uuid[]) from public,anon;
grant execute on function public.approve_mzs_registered_request(uuid,text,uuid[]) to authenticated;

-- Existing access editing screen uses this function. Compare the old & new
-- sets before queuing a notification; do not mail about unchanged access.
create or replace function public.set_relationship_project_access(
 p_user_id uuid,p_project_id uuid,p_offering_ids uuid[]
) returns integer language plpgsql security definer set search_path=''
as $$
declare
  v_ids uuid[];v_old uuid[];v_added uuid[];v_count integer;
  v_active boolean;v_project_title text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is not true then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_user_id is null or p_project_id is null or p_offering_ids is null
  or array_position(p_offering_ids,null) is not null or cardinality(p_offering_ids)>100
  or array_ndims(p_offering_ids)>1 then
   raise exception 'Invalid project access request' using errcode='22023';
 end if;
 select p.is_active into v_active from public.profiles p where p.id=p_user_id
   and p.role in ('client'::public.user_role,'partner'::public.user_role) for update;
 if not found then raise exception 'Eligible client or partner not found'; end if;
 select title into v_project_title from public.projects
   where id=p_project_id and status='active';
 if not found then raise exception 'Active project not found'; end if;
 select coalesce(array_agg(distinct x order by x),array[]::uuid[]) into v_ids
   from unnest(p_offering_ids) as x;
 select count(*) into v_count from public.offerings
   where id=any(v_ids) and project_id=p_project_id and status='active';
 if v_count<>cardinality(v_ids) then
   raise exception 'Offerings do not belong to the project' using errcode='22023';
 end if;
 select coalesce(array_agg(o.id order by o.id),array[]::uuid[]) into v_old
   from public.offering_access oa join public.offerings o on o.id=oa.offering_id
   where oa.user_id=p_user_id and o.project_id=p_project_id;
 select coalesce(array_agg(x order by x),array[]::uuid[]) into v_added
   from unnest(v_ids) as x where not x=any(v_old);

 delete from public.offering_access oa using public.offerings o
   where oa.offering_id=o.id and oa.user_id=p_user_id and o.project_id=p_project_id
     and not oa.offering_id=any(v_ids);
 insert into public.offering_access(user_id,offering_id)
   select p_user_id,unnest(v_ids) on conflict do nothing;
 if cardinality(v_ids)>0 then
   insert into public.project_access(user_id,project_id) values(p_user_id,p_project_id)
   on conflict do nothing;
 else delete from public.project_access where user_id=p_user_id and project_id=p_project_id;
 end if;

 if v_active and cardinality(v_added)>0 then
   insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
   values(p_user_id,'new_project_access',
     jsonb_build_object('project',v_project_title,'added_types',
       (select coalesce(jsonb_agg(distinct o.offering_type::text),'[]'::jsonb)
        from public.offerings o where o.id=any(v_added))),
     'project-grant:'||p_user_id::text||':'||p_project_id::text||':'||gen_random_uuid()::text);
 end if;
 return cardinality(v_ids);
end $$;

-- Legacy manual activation remains available, but must not circumvent a
-- self-registered application's required email verification and approval.
create or replace function public.set_relationship_active(p_user_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or (select public.is_admin()) is not true then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_user_id is null or p_active is null or p_user_id=(select auth.uid()) then
   raise exception 'Invalid account or status' using errcode='22023';
 end if;
 if p_active and exists(
   select 1 from public.access_requests r where r.auth_user_id=p_user_id and r.status<>'approved'
 ) then raise exception 'Use verified application approval before activation' using errcode='42501'; end if;
 update public.profiles set is_active=p_active where id=p_user_id
   and role in ('client'::public.user_role,'partner'::public.user_role);
 if not found then raise exception 'Eligible account not found' using errcode='42501'; end if;
 return true;
end $$;

commit;