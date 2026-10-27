create table public.mzs_owner_stay_cleanup_audit (
 id bigint generated always as identity primary key,
 request_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 reason text not null check (length(btrim(reason)) between 5 and 500),
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index mzs_owner_stay_cleanup_request on public.mzs_owner_stay_cleanup_audit(request_id,created_at);
create index mzs_owner_stay_cleanup_actor on public.mzs_owner_stay_cleanup_audit(actor_id);
alter table public.mzs_owner_stay_cleanup_audit enable row level security;
revoke all on public.mzs_owner_stay_cleanup_audit from public,anon,authenticated;
grant select on public.mzs_owner_stay_cleanup_audit to authenticated;
create policy owner_cleanup_admin_read on public.mzs_owner_stay_cleanup_audit
 for select to authenticated using ((select public.is_admin()));

-- Privileged atomic mutation: callers have no direct DELETE/audit INSERT grant.
-- Match the existing administrator RPC boundary; validate role and row under lock.
create function public.mzs_admin_delete_closed_owner_stay(
 p_request_id uuid,p_reason text,p_expected_status text,p_check_in date,p_check_out date
) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.mzs_owner_stay_requests;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then
  raise exception 'Provide a reason (5–500 characters)';
 end if;
 select * into r from public.mzs_owner_stay_requests where id=p_request_id for update;
 if not found then raise exception 'Request unavailable or already removed'; end if;
 if r.status not in ('declined','cancelled') or r.booking_id is not null then
  raise exception 'Only closed requests without a linked reservation can be deleted';
 end if;
 if r.status is distinct from p_expected_status or r.check_in is distinct from p_check_in
    or r.check_out is distinct from p_check_out then
  raise exception 'Request changed. Refresh before continuing';
 end if;
 insert into public.mzs_owner_stay_cleanup_audit(request_id,actor_id,reason,snapshot)
 values(r.id,auth.uid(),btrim(p_reason),to_jsonb(r));
 delete from public.mzs_owner_stay_requests where id=r.id;
 return true;
end $$;
revoke all on function public.mzs_admin_delete_closed_owner_stay(uuid,text,text,date,date) from public,anon,service_role;
grant execute on function public.mzs_admin_delete_closed_owner_stay(uuid,text,text,date,date) to authenticated;
