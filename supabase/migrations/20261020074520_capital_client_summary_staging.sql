-- Staging-only pilot. No production migration or real relationship grants.
create table public.mzs_capital_client_access (
 id uuid primary key default gen_random_uuid(),
 deal_id uuid not null references public.mzs_capital_deals(id),
 user_id uuid not null references public.profiles(id),
 party_role text not null check (party_role in ('lender','borrower')),
 display_label text not null check(length(display_label) between 2 and 120),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(deal_id,user_id)
);
create index on public.mzs_capital_client_access(user_id) where is_active;
alter table public.mzs_capital_client_access enable row level security;
revoke all on public.mzs_capital_client_access from public,anon,authenticated;
grant select,insert on public.mzs_capital_client_access to authenticated;
grant update(is_active,party_role,display_label) on public.mzs_capital_client_access to authenticated;
create policy full_admin_read on public.mzs_capital_client_access for select to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active));
create policy full_admin_insert on public.mzs_capital_client_access for insert to authenticated
 with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active));
create policy full_admin_update on public.mzs_capital_client_access for update to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active))
 with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active));
create trigger capital_client_access_audit after insert or update on public.mzs_capital_client_access
 for each row execute function public.mzs_capital_deal_log();

-- Narrow, read-only projection. Definer needed because the raw financial tables
-- MUST remain inaccessible to clients. No user/deal ID supplied by the caller.
create function public.mzs_my_capital_summaries() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role in ('client','partner')) then
  raise exception 'Active client or partner required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'label',a.display_label,'party_role',a.party_role,
  'principal',d.principal,'currency',d.currency,'start_date',d.start_date,'end_date',d.maturity_date,
  'total_interest_received',case when a.party_role='lender' then coalesce(p.total,0) else 0 end,
  'total_interest_paid',case when a.party_role='borrower' then coalesce(p.total,0) else 0 end,
  'interest_payments',coalesce(p.entries,'[]'::jsonb)
 ) order by a.created_at,a.id),'[]'::jsonb) into result
 from public.mzs_capital_client_access a
 join public.mzs_capital_deals d on d.id=a.deal_id
 left join lateral (
  select sum(x.amount) as total,jsonb_agg(jsonb_build_object('date',x.paid_on,'amount',x.amount) order by x.paid_on,x.id) as entries
  from public.mzs_capital_payments x join public.mzs_capital_instalments i on i.id=x.instalment_id
  where i.deal_id=d.id and i.kind='interest' and not x.is_void
 ) p on true
 where a.user_id=caller and a.is_active;
 return result;
end $$;
revoke all on function public.mzs_my_capital_summaries() from public,anon,authenticated;
grant execute on function public.mzs_my_capital_summaries() to authenticated;
