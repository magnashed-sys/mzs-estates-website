-- Backward-compatible expansion of the existing caller-scoped projection.
-- No payment, schedule, grant, or document is changed. Raw tables stay private.
create or replace function public.mzs_my_capital_summaries() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role in ('client','partner')) then
  raise exception 'Active client or partner required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'summary_version',2,'id',a.id,'label',a.display_label,'party_role',a.party_role,
  'principal',d.principal,'currency',d.currency,'annual_rate',d.annual_rate,
  'start_date',d.start_date,'end_date',d.maturity_date,
  'total_interest_received',case when a.party_role='lender' then coalesce(p.total,0) else 0 end,
  'total_interest_paid',case when a.party_role='borrower' then coalesce(p.total,0) else 0 end,
  'interest_payments',coalesce(p.entries,'[]'::jsonb),
  'interest_schedule',coalesce(s.entries,'[]'::jsonb)
 ) order by a.created_at,a.id),'[]'::jsonb) into result
 from public.mzs_capital_client_access a join public.mzs_capital_deals d on d.id=a.deal_id
 left join lateral (
  select sum(x.amount) as total,jsonb_agg(jsonb_build_object(
   'date',x.paid_on,'amount',x.amount,'instalment_id',x.instalment_id
  ) order by x.paid_on,x.id) as entries
  from public.mzs_capital_payments x join public.mzs_capital_instalments i on i.id=x.instalment_id
  where i.deal_id=d.id and i.kind='interest' and not x.is_void
 ) p on true
 left join lateral (
  select jsonb_agg(jsonb_build_object('id',i.id,'due_date',i.due_date,'amount',i.amount)
   order by i.due_date,i.id) as entries
  from public.mzs_capital_instalments i where i.deal_id=d.id and i.kind='interest'
 ) s on true
 where a.user_id=caller and a.is_active;
 return result;
end $$;
revoke all on function public.mzs_my_capital_summaries() from public,anon,authenticated;
grant execute on function public.mzs_my_capital_summaries() to authenticated;
