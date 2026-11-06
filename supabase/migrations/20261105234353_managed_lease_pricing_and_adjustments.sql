-- Existing contracts remain unclassified until an administrator checks their agreement.
alter table public.mzs_lease_contracts
 add column pricing_basis text not null default 'unclassified' check(pricing_basis in ('unclassified','all_in','separate')),
 add column line_roles jsonb not null default '[]',
 add column indexation_review_on date,
 add column indexation_clause text not null default '' check(length(indexation_clause)<=2000),
 add column template_version text not null default '' check(length(template_version)<=100);

create function mzs_private.validate_lease_pricing() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(new.line_roles) is distinct from 'array' then raise exception 'Invalid line classification'; end if;
 if new.pricing_basis='unclassified' then
  if new.line_roles<>'[]'::jsonb then raise exception 'Classify the pricing basis first'; end if;
 else
  if jsonb_array_length(new.line_roles)<>jsonb_array_length(new.lines) or exists(
   select 1 from jsonb_array_elements_text(new.line_roles) r where r is null or
    (new.pricing_basis='all_in' and r<>'all_in') or
    (new.pricing_basis='separate' and r not in ('rent','advance','other'))
  ) then raise exception 'All-in contracts cannot have separate rent or advances; classify every line'; end if;
  if new.pricing_basis='separate' and not new.line_roles ? 'rent' then raise exception 'Separate pricing requires a basic rent line'; end if;
 end if;
 if new.indexation_review_on is not null and (extract(day from new.indexation_review_on)<>1 or new.indexation_review_on<new.first_period or new.indexation_review_on>'2100-12-01') then raise exception 'Choose a valid first-of-month indexation review date';end if;
 if new.pricing_basis='all_in' and new.indexation_review_on is not null then raise exception 'An unsplit all-in price has no automatic rent indexation';end if;
 return new;
end $$;
revoke all on function mzs_private.validate_lease_pricing() from public,anon,authenticated,service_role;
create trigger lease_pricing_validate before insert or update on public.mzs_lease_contracts for each row execute function mzs_private.validate_lease_pricing();

create table public.mzs_lease_adjustments (
 id uuid primary key default gen_random_uuid(),
 revision bigint generated always as identity unique,
 contract_id uuid not null references public.mzs_lease_contracts(id) on delete restrict,
 kind text not null check(kind in ('indexation','advance')),
 effective_on date not null check(extract(day from effective_on)=1 and effective_on between '2026-12-01' and '2100-12-01'),
 status text not null default 'proposed' check(status in ('proposed','approved','cancelled')),
 base_lines jsonb not null,
 new_lines jsonb not null,
 calculation jsonb not null,
 evidence text not null check(length(btrim(evidence)) between 5 and 2000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 approved_by uuid references public.profiles(id), approved_at timestamptz,
 decision_note text not null default '',
 decided_by uuid references public.profiles(id), decided_at timestamptz
);
create index lease_adjustment_contract_period on public.mzs_lease_adjustments(contract_id,effective_on desc,revision desc);
create index lease_adjustment_created_by on public.mzs_lease_adjustments(created_by);
create index lease_adjustment_approved_by on public.mzs_lease_adjustments(approved_by);
create index lease_adjustment_decided_by on public.mzs_lease_adjustments(decided_by);
alter table public.mzs_lease_adjustments enable row level security;
revoke all on public.mzs_lease_adjustments from public,anon,authenticated,service_role;
grant select on public.mzs_lease_adjustments to authenticated;
create policy lease_adjustment_admin_read on public.mzs_lease_adjustments for select to authenticated using ((select public.is_admin()));
revoke all on sequence public.mzs_lease_adjustments_revision_seq from public,anon,authenticated,service_role;

-- Server-authoritative arithmetic. RPC callers cannot supply replacement amounts or snapshots.
create function mzs_private.propose_lease_adjustment(p_contract uuid,p_effective date,p_kind text,p_input jsonb,p_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.mzs_lease_contracts; base jsonb; result jsonb; l jsonb; role text; rate numeric; amount numeric; budget numeric; months integer; line_index integer; n integer:=0; proposal_id uuid; latest date;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active Group administrator required' using errcode='42501';end if;
 select * into strict c from public.mzs_lease_contracts where id=p_contract for update;
 if c.status<>'active' or c.pricing_basis<>'separate' then raise exception 'An active contract with confirmed separate rent and advances is required';end if;
 if p_effective is null or extract(day from p_effective)<>1 or p_effective<greatest(c.first_period,(now() at time zone 'Europe/Amsterdam')::date) or p_effective>'2100-12-01' or (c.lease_end is not null and p_effective>c.lease_end) or (c.max_terms is not null and p_effective >= (c.first_period+make_interval(months=>c.max_terms))::date) then raise exception 'Choose a future uninvoiced rental month within this contract';end if;
 select max(effective_on) into latest from public.mzs_lease_adjustments where contract_id=c.id and status='approved';
 if p_effective<latest or exists(select 1 from public.mzs_lease_invoice_drafts where contract_id=c.id and period_start>=p_effective) then raise exception 'Later terms or invoice drafts already exist; existing invoices are preserved';end if;
 select new_lines into base from public.mzs_lease_adjustments where contract_id=c.id and status='approved' order by effective_on desc,revision desc limit 1;
 base:=coalesce(base,c.lines);result:='[]';
 if p_kind='indexation' then
  if exists(select 1 from public.mzs_lease_adjustments where contract_id=c.id and kind='indexation' and status='approved' and effective_on>p_effective-interval '1 year') then raise exception 'Annual indexation requires at least twelve months since the previous approved indexation';end if;
  if p_input->>'method'='cpi' then
   if coalesce(p_input->>'old_index','') !~ '^\d{1,6}(\.\d{1,6})?$' or coalesce(p_input->>'new_index','') !~ '^\d{1,6}(\.\d{1,6})?$' or (p_input->>'old_index')::numeric<=0 or (p_input->>'new_index')::numeric<=0 then raise exception 'Provide positive comparable CPI indices';end if;
   rate:=((p_input->>'new_index')::numeric/(p_input->>'old_index')::numeric-1)*100;
  elsif p_input->>'method'='percentage' then
   if coalesce(p_input->>'percentage','') !~ '^-?\d{1,3}(\.\d{1,6})?$' then raise exception 'Provide a valid percentage';end if;
   rate:=(p_input->>'percentage')::numeric;
  else raise exception 'Choose percentage or CPI calculation';end if;
  if rate not between -100 and 100 then raise exception 'Percentage outside supported calculation range';end if;
  if coalesce(p_input->>'ceiling','')<>'' then
   if p_input->>'ceiling' !~ '^\d{1,3}(\.\d{1,6})?$' then raise exception 'Invalid verified percentage ceiling';end if;
   rate:=least(rate,(p_input->>'ceiling')::numeric);
  end if;
  p_input:=p_input||jsonb_build_object('applied_percentage',rate);
 elsif p_kind='advance' then
  if coalesce(p_input->>'annual_budget','') !~ '^\d{1,10}(\.\d{1,2})?$' or coalesce(p_input->>'months','') !~ '^\d{1,2}$' or coalesce(p_input->>'line_index','') !~ '^\d{1,2}$' then raise exception 'Provide the allocated budget, month count and advance line';end if;
  budget:=(p_input->>'annual_budget')::numeric;months:=(p_input->>'months')::integer;line_index:=(p_input->>'line_index')::integer;
  if months not between 1 and 12 or (c.line_roles->>line_index) is distinct from 'advance' then raise exception 'Choose an existing advance line and one to twelve months';end if;
 else raise exception 'Invalid adjustment type';end if;
 for l in select value from jsonb_array_elements(base) loop
  role:=c.line_roles->>n;amount:=(l->>'amount')::numeric;
  if p_kind='indexation' and role='rent' then amount:=round(amount*(1+rate/100),2);end if;
  if p_kind='advance' and n=line_index then amount:=round(budget/months,2);end if;
  if amount<0 or amount>=10000000000 then raise exception 'Calculated amount exceeds supported range';end if;
  result:=result||jsonb_build_array(l||jsonb_build_object('amount',to_char(amount,'FM9999999990.00')));n:=n+1;
 end loop;
 insert into public.mzs_lease_adjustments(contract_id,kind,effective_on,base_lines,new_lines,calculation,evidence,created_by)
 values(c.id,p_kind,p_effective,base,result,p_input,p_evidence,auth.uid()) returning mzs_lease_adjustments.id into proposal_id;
 return proposal_id;
end $$;
revoke all on function mzs_private.propose_lease_adjustment(uuid,date,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.propose_lease_adjustment(uuid,date,text,jsonb,text) to authenticated;
create function public.mzs_propose_lease_adjustment(p_contract uuid,p_effective date,p_kind text,p_input jsonb,p_evidence text)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.propose_lease_adjustment(p_contract,p_effective,p_kind,p_input,p_evidence)$$;
revoke all on function public.mzs_propose_lease_adjustment(uuid,date,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_propose_lease_adjustment(uuid,date,text,jsonb,text) to authenticated;

create function mzs_private.decide_lease_adjustment(p_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.mzs_lease_adjustments; c public.mzs_lease_contracts; base jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active Group administrator required' using errcode='42501';end if;
 if p_approve is null or coalesce(length(btrim(p_note)),0) not between 5 and 2000 then raise exception 'Record the review or cancellation reason';end if;
 select * into strict a from public.mzs_lease_adjustments where id=p_id;
 select * into strict c from public.mzs_lease_contracts where id=a.contract_id for update;
 select * into strict a from public.mzs_lease_adjustments where id=p_id for update;
 if a.status<>'proposed' then raise exception 'This proposal was already decided';end if;
 if p_approve then
  select new_lines into base from public.mzs_lease_adjustments where contract_id=c.id and status='approved' order by effective_on desc,revision desc limit 1;
  if c.status<>'active' or c.pricing_basis<>'separate' or coalesce(base,c.lines)<>a.base_lines then raise exception 'Contract or pricing changed; prepare a fresh proposal';end if;
  if a.effective_on<(now() at time zone 'Europe/Amsterdam')::date or exists(select 1 from public.mzs_lease_adjustments where contract_id=c.id and status='approved' and (effective_on>a.effective_on or (a.kind='indexation' and kind='indexation' and effective_on>a.effective_on-interval '1 year'))) or exists(select 1 from public.mzs_lease_invoice_drafts where contract_id=c.id and period_start>=a.effective_on) then raise exception 'Period already invoiced or superseded; prepare a fresh proposal';end if;
 end if;
 update public.mzs_lease_adjustments set status=case when p_approve then 'approved' else 'cancelled' end,
  approved_by=case when p_approve then auth.uid() end,approved_at=case when p_approve then now() end,
  decision_note=p_note,decided_by=auth.uid(),decided_at=now() where id=a.id;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c.id,auth.uid(),case when p_approve then 'pricing_approved' else 'pricing_cancelled' end,
  (select to_jsonb(x) from public.mzs_lease_adjustments x where id=a.id));
end $$;
revoke all on function mzs_private.decide_lease_adjustment(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.decide_lease_adjustment(uuid,boolean,text) to authenticated;
create function public.mzs_decide_lease_adjustment(p_id uuid,p_approve boolean,p_note text)
returns void language sql security invoker set search_path='' as $$select mzs_private.decide_lease_adjustment(p_id,p_approve,p_note)$$;
revoke all on function public.mzs_decide_lease_adjustment(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_decide_lease_adjustment(uuid,boolean,text) to authenticated;

-- The existing generator locks the contract before creating an invoice. Approval takes
-- the same lock, so a concurrent generation/approval cannot silently use stale amounts.
create function mzs_private.apply_lease_pricing() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.mzs_lease_adjustments; l jsonb; factor numeric; net numeric; vat numeric;
begin
 select * into a from public.mzs_lease_adjustments where contract_id=new.contract_id and status='approved' and effective_on<=new.period_start order by effective_on desc,revision desc limit 1;
 if not found then return new;end if;
 factor:=(new.snapshot->>'proration_factor')::numeric;
 if factor is null or factor<=0 or factor>1 then raise exception 'Invalid invoice proration';end if;
 new.lines:='[]';new.subtotal:=0;new.tax_total:=0;
 for l in select value from jsonb_array_elements(a.new_lines) loop
  net:=round((l->>'amount')::numeric*factor,2);vat:=case when l->>'vat'='exempt' then 0 else round(net*(l->>'vat')::numeric/100,2) end;
  new.subtotal:=new.subtotal+net;new.tax_total:=new.tax_total+vat;
  new.lines:=new.lines||jsonb_build_array(l||jsonb_build_object('net',net,'tax',vat,'total',net+vat));
 end loop;
 new.total:=new.subtotal+new.tax_total;
 new.snapshot:=new.snapshot||jsonb_build_object('lines',a.new_lines,'pricing_adjustment_id',a.id,'pricing_effective_on',a.effective_on,'pricing_revision',a.revision);
 return new;
end $$;
revoke all on function mzs_private.apply_lease_pricing() from public,anon,authenticated,service_role;
create trigger lease_apply_approved_pricing before insert on public.mzs_lease_invoice_drafts for each row execute function mzs_private.apply_lease_pricing();

-- One-time classification of existing active contracts changes no amounts or parties.
CREATE OR REPLACE FUNCTION mzs_private.validate_lease()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare line jsonb; n integer;
begin
 if new.status='draft' then new.first_generation_date:=(new.first_period-interval '1 month')::date+13; end if;
 if new.status='active' then
  if new.first_period<'2026-12-01' then raise exception 'The first MZS billing month is December 2026 or later'; end if;
  if new.first_generation_date<>(new.first_period-interval '1 month')::date+13 then raise exception 'Drafts must be prepared on the 14th of the preceding month'; end if;
  if length(trim(new.tenant_address))<2 or length(trim(new.issuer_address))<2 or length(trim(new.issuer_iban))<5 then raise exception 'Complete tenant address, issuer address and IBAN before activating billing'; end if;
 end if;
 -- Serialise activation for units in the same property, preventing conflicting active contracts.
 perform pg_advisory_xact_lock(hashtext(new.property_id::text));
 perform 1 from public.mzs_estate_properties where id=new.property_id;
 if not found then raise exception 'Property unavailable'; end if;
 select count(*) into n from public.mzs_estate_units where property_id=new.property_id and id=any(new.unit_ids);
 if n<>cardinality(new.unit_ids) then raise exception 'Select distinct units belonging to the selected property'; end if;
 if regexp_replace(new.invoice_subject,'\{(unitadres|maand|jaar)\}','','g') ~ '[{}]' then raise exception 'Unknown invoice subject placeholder'; end if;
 for line in select value from jsonb_array_elements(new.lines) loop
  if coalesce(length(trim(line->>'description')),0) not between 1 and 200
   or coalesce(line->>'amount','') !~ '^\d{1,10}(\.\d{1,2})?$'
   or coalesce(line->>'vat','') not in ('exempt','0','9','21') then
   raise exception 'Each line needs a description, a non-negative amount with at most two decimals and a VAT choice';
  end if;
 end loop;
 if new.lease_end is not null and new.first_period>new.lease_end then raise exception 'First invoice period is after the contract ends'; end if;
 if tg_op='UPDATE' then
  if old.status<>'draft' and (to_jsonb(new)-array['status','updated_at','version']) is distinct from (to_jsonb(old)-array['status','updated_at','version']) then
   -- Only fill missing identifiers from linked master records before first invoicing.
   if not coalesce(
    (old.status='active' and new.status='active' and old.pricing_basis='unclassified' and new.pricing_basis in ('all_in','separate')
     and (to_jsonb(new)-array['updated_at','version','pricing_basis','line_roles','indexation_review_on','indexation_clause','template_version'])
       = (to_jsonb(old)-array['updated_at','version','pricing_basis','line_roles','indexation_review_on','indexation_clause','template_version'])) or
    old.status='active' and new.status='active'
    and (current_user in ('postgres','supabase_admin') or coalesce(public.is_admin(),false))
    and (to_jsonb(new)-array['updated_at','version','tenant_email','issuer_tax_id'])
      = (to_jsonb(old)-array['updated_at','version','tenant_email','issuer_tax_id'])
    and not exists(select 1 from public.mzs_lease_invoice_drafts i where i.contract_id=old.id)
    and (new.tenant_email=old.tenant_email or (
      length(trim(old.tenant_email))=0
      and new.tenant_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and new.tenant_email=(select r.email from public.mzs_lease_relationships r where r.id=old.tenant_relationship_id)
    ))
    and (new.issuer_tax_id=old.issuer_tax_id or (
      length(trim(old.issuer_tax_id))=0 and length(trim(new.issuer_tax_id))>0
      and new.issuer_tax_id=(select e.tax_id from public.mzs_lease_issuers e where e.id=old.issuer_id)
    )),false) then
    raise exception 'Activated terms are locked. Stop the billing schedule and create a replacement contract for changed terms';
   end if;
  end if;
  if old.status='active' and new.status not in ('active','stopped') or old.status='stopped' and new.status<>'stopped' then raise exception 'Invalid contract transition'; end if;
  new.version:=old.version+1;
 else
  if new.status<>'draft' then raise exception 'Create and review a draft before activation'; end if;
  new.version:=1;
 end if;
 if new.status='active' and exists(select 1 from public.mzs_lease_contracts c where c.id<>new.id and c.status='active' and c.unit_ids && new.unit_ids and daterange(c.lease_start,c.lease_end,'[]') && daterange(new.lease_start,new.lease_end,'[]')) then
  raise exception 'A selected unit already has an active contract for this period';
 end if;
 if new.status='active' and (tg_op='INSERT' or old.status='draft') and exists(select 1 from public.mzs_lease_invoice_drafts i where i.contract_id<>new.id and (i.snapshot->'unit_ids') ?| new.unit_ids::text[] and i.period_start>=new.first_period and i.period_start<=coalesce(new.lease_end,'infinity'::date)) then
  raise exception 'An invoice draft already covers these units in the proposed billing period. Choose the next uninvoiced month';
 end if;
 new.updated_at:=now(); return new;
end $function$
;
