-- First-party visit reporting. No browser role can read or write these tables.
create table public.mzs_visitor_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  recipient_user_id uuid references public.profiles(id),
  started_at timestamptz not null default now()
);
insert into public.mzs_visitor_settings(singleton) values(true);
create table public.mzs_visitor_activity (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  kind text not null check(kind in ('login','page')),
  path text not null check(length(path)<=250 and path !~ '[?#%]'),
  occurred_at timestamptz not null default now()
);
create unique index mzs_visitor_login_session on public.mzs_visitor_activity(session_id) where kind='login';
create index mzs_visitor_time on public.mzs_visitor_activity(occurred_at);
create index mzs_visitor_user_time on public.mzs_visitor_activity(user_id,occurred_at);
create table public.mzs_visitor_reports (
  report_day date primary key,
  recipient_user_id uuid not null references public.profiles(id),
  status text not null check(status in ('sending','accepted','failed','uncertain')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  error_category text
);
alter table public.mzs_visitor_settings enable row level security;
alter table public.mzs_visitor_activity enable row level security;
alter table public.mzs_visitor_reports enable row level security;
revoke all on public.mzs_visitor_settings,public.mzs_visitor_activity,public.mzs_visitor_reports from public,anon,authenticated;
grant select,insert,update,delete on public.mzs_visitor_settings,public.mzs_visitor_activity,public.mzs_visitor_reports to service_role;

-- SECURITY INVOKER: only the service role can call after server-side identity checks.
create function public.mzs_record_visitor_activity(p_user uuid,p_session uuid,p_event uuid,p_kind text,p_path text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.mzs_visitor_settings where singleton and enabled) then return; end if;
  if not exists(select 1 from public.profiles where id=p_user and is_active and role::text in ('admin','client','partner')) then
    raise exception 'Active account required' using errcode='42501';
  end if;
  if p_kind not in ('login','page') or p_path is null or length(p_path)>250 or p_path ~ '[?#%]' then raise exception 'Invalid activity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if (select count(*) from public.mzs_visitor_activity where user_id=p_user and occurred_at>now()-interval '1 minute')>=60 then return; end if;
  insert into public.mzs_visitor_activity(id,user_id,session_id,kind,path)
  values(p_event,p_user,p_session,p_kind,p_path) on conflict do nothing;
end $$;
revoke all on function public.mzs_record_visitor_activity(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mzs_record_visitor_activity(uuid,uuid,uuid,text,text) to service_role;

create function public.mzs_visitor_summary(p_start timestamptz,p_end timestamptz)
returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(summary)),'[]'::jsonb) from (
 select p.full_name as name,p.email,p.role::text as role,a.kind,a.path,count(*) as total,min(a.occurred_at) as first,max(a.occurred_at) as last
 from public.mzs_visitor_activity a join public.profiles p on p.id=a.user_id
 where a.occurred_at>=p_start and a.occurred_at<p_end
 group by p.id,p.full_name,p.email,p.role,a.kind,a.path
 order by p.full_name,p.id,min(a.occurred_at)
 ) summary;
$$;
revoke all on function public.mzs_visitor_summary(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.mzs_visitor_summary(timestamptz,timestamptz) to service_role;
