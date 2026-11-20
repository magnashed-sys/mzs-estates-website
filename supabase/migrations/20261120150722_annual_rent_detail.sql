create function public.mzs_cockpit_contract_rent_rows(p_year integer)
returns table(contract_id uuid, month_start date, invoiced numeric, scheduled_amount numeric) language sql stable security invoker set search_path='' as $$
with months as (
 select m::date as start_on, (m+interval '1 month')::date as next_on
 from generate_series(make_date(p_year,1,1)::timestamp,make_date(p_year,12,1)::timestamp,interval '1 month') m
), issued as (
 select i.contract_id,(part->>'month')::date as start_on,(part->>'cents')::numeric/100 amount
 from public.mzs_lease_invoices i join public.mzs_lease_invoice_drafts d on i.draft_id=d.id
 cross join lateral mzs_private.revenue_months(i.total,coalesce((i.payload#>>'{snapshot,covered_from}')::date,d.period_start),coalesce((i.payload#>>'{snapshot,covered_to}')::date,d.period_end)+1,true) parts
 cross join lateral jsonb_array_elements(parts) part
 where (part->>'month')::date between make_date(p_year,1,1) and make_date(p_year,12,31)
), scheduled as (
 select c.id contract_id,m.start_on,net + round(net*coalesce(nullif(line->>'vat','exempt')::numeric,0)/100,2) as amount
 from months m join public.mzs_lease_contracts c on c.status='active' and c.first_period<=m.start_on and c.lease_start<m.next_on and (c.lease_end is null or c.lease_end>=m.start_on)
 and m.start_on < c.first_period + make_interval(months=>least(coalesce(c.max_terms,600),600))
 left join lateral (select a.new_lines from public.mzs_lease_adjustments a where a.contract_id=c.id and a.status='approved' and a.effective_on<=m.start_on order by a.effective_on desc,a.revision desc limit 1) adj on true
 cross join lateral jsonb_array_elements(coalesce(adj.new_lines,c.lines)) line
 cross join lateral (select round((line->>'amount')::numeric * case when c.prorate then (least(m.next_on,coalesce(c.lease_end+1,m.next_on))-greatest(m.start_on,c.lease_start))::numeric/(m.next_on-m.start_on) else 1 end,2) net) priced
 where not exists(select 1 from issued i where i.contract_id=c.id and i.start_on=m.start_on)
)
select x.contract_id,x.start_on,sum(x.invoiced),sum(x.scheduled_amount)
from (select i.contract_id,i.start_on,i.amount as invoiced,0::numeric scheduled_amount from issued i
 union all select s.contract_id,s.start_on,0::numeric,s.amount from scheduled s) x
group by x.contract_id,x.start_on
$$;
revoke all on function public.mzs_cockpit_contract_rent_rows(integer) from public,anon;
grant execute on function public.mzs_cockpit_contract_rent_rows(integer) to authenticated;
create or replace function public.mzs_cockpit_contract_rent(p_year integer) returns numeric language sql stable security invoker set search_path='' as $$
select coalesce(sum(invoiced+scheduled_amount),0) from public.mzs_cockpit_contract_rent_rows(p_year)
$$;