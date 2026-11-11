-- Internal owner reports. No browser/API role can enqueue or read these reports.
create table public.mzs_owner_report_outbox (
 id uuid primary key default gen_random_uuid(),
 delivery_key text not null unique check(delivery_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
 subject text not null check(length(subject) between 1 and 180 and subject !~ E'[\\r\\n]'),
 body_text text not null check(length(body_text) between 1 and 60000),
 recipient text not null default 'magdy@mzsgroup.eu' check(recipient='magdy@mzsgroup.eu'),
 status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 completed_at timestamptz,
 error_category text
);
alter table public.mzs_owner_report_outbox enable row level security;
revoke all on public.mzs_owner_report_outbox from public,anon,authenticated,service_role;
grant select on public.mzs_owner_report_outbox to service_role;
grant update(status,claimed_at,completed_at,error_category) on public.mzs_owner_report_outbox to service_role;
create index owner_report_pending on public.mzs_owner_report_outbox(created_at) where status='pending';

-- Only the trusted database operator queues an explicitly authorized report.
create function public.mzs_enqueue_owner_report(p_key text,p_subject text,p_body text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; existing public.mzs_owner_report_outbox;
begin
 insert into public.mzs_owner_report_outbox(delivery_key,subject,body_text)
 values(p_key,p_subject,p_body) on conflict(delivery_key) do nothing returning id into result;
 if result is not null then return result;end if;
 select * into existing from public.mzs_owner_report_outbox where delivery_key=p_key;
 if existing.subject is distinct from p_subject or existing.body_text is distinct from p_body
 then raise exception 'Report key already exists with different content';end if;
 return existing.id;
end;$$;
revoke all on function public.mzs_enqueue_owner_report(text,text,text) from public,anon,authenticated,service_role;

-- Atomic claim: neither concurrent cron runs nor ambiguous SMTP outcomes resend.
create function public.mzs_claim_owner_report()
returns setof public.mzs_owner_report_outbox language sql security invoker set search_path='' as $$
 update public.mzs_owner_report_outbox set status='sending',claimed_at=now()
 where id=(select id from public.mzs_owner_report_outbox where status='pending'
 order by created_at,id for update skip locked limit 1)
 returning *;
$$;
revoke all on function public.mzs_claim_owner_report() from public,anon,authenticated;
grant execute on function public.mzs_claim_owner_report() to service_role;
