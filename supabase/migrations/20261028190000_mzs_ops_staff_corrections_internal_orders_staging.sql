-- STAGING ONLY — auditable staff correction requests, internal maintenance work orders,
-- and private property-scoped maintenance photo evidence.
-- No automatic vendor commitment, payments, email, client invoice, or corrected billing.
begin;

create table public.mzs_ops_visit_correction_requests (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null unique references public.mzs_ops_staff_visits(id) on delete restrict,
 proposed_minutes integer not null check (proposed_minutes between 1 and 960),
 reason text not null check(length(btrim(reason)) between 10 and 1000 and reason !~ '[[:cntrl:]]'),
 requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_visit_correction_visit on public.mzs_ops_visit_correction_requests(visit_id);
alter table public.mzs_ops_visit_correction_requests enable row level security;
revoke all on public.mzs_ops_visit_correction_requests from public,anon,authenticated,service_role;
grant select on public.mzs_ops_visit_correction_requests to authenticated;
grant insert(visit_id,proposed_minutes,reason) on public.mzs_ops_visit_correction_requests to authenticated;
create policy ops_visit_correction_read on public.mzs_ops_visit_correction_requests
 for select to authenticated using (
 (select public.is_admin()) or
 (requested_by=(select auth.uid()) and exists(
  select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
   and (select mzs_private.ops_can_work_on_property(v.property_id))))
 );
create policy ops_visit_correction_insert on public.mzs_ops_visit_correction_requests
 for insert to authenticated with check (
 requested_by=(select auth.uid()) and
 (select public.is_admin() or exists(
  select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
    and (select mzs_private.ops_can_work_on_property(v.property_id))))
 );
create function mzs_private.ops_validate_visit_correction_request()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare original public.mzs_ops_staff_visits;
begin
 if (select auth.uid()) is null or new.requested_by is distinct from (select auth.uid())
 then raise exception 'Authenticated request author required' using errcode='42501';end if;
 select * into original from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if not ( (select public.is_admin()) or
  (original.profile_id=(select auth.uid()) and mzs_private.ops_can_work_on_property(original.property_id)))
 then raise exception 'Only creator or administrator may request visit correction' using errcode='42501';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews r where r.visit_id=new.visit_id)
 then raise exception 'Reviewed visits require separate supervisor reassessment; original preserved';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=new.visit_id)
 then raise exception 'A correction proposal already exists';end if;
 if original.actual_minutes=new.proposed_minutes
 then raise exception 'Correction must change actual minutes';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_correction_request() from public,anon,authenticated,service_role;
create trigger ops_visit_correction_request_guard before insert on public.mzs_ops_visit_correction_requests
 for each row execute function mzs_private.ops_validate_visit_correction_request();

create table public.mzs_ops_visit_correction_decisions (
 id uuid primary key default gen_random_uuid(),
 correction_id uuid not null unique references public.mzs_ops_visit_correction_requests(id) on delete restrict,
 decision text not null check(decision in ('approved','rejected')),
 reason text not null check(length(btrim(reason)) between 8 and 1000 and reason !~ '[[:cntrl:]]'),
 decided_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 decided_at timestamptz not null default now()
);
alter table public.mzs_ops_visit_correction_decisions enable row level security;
revoke all on public.mzs_ops_visit_correction_decisions from public,anon,authenticated,service_role;
grant select on public.mzs_ops_visit_correction_decisions to authenticated;
grant insert(correction_id,decision,reason) on public.mzs_ops_visit_correction_decisions to authenticated;
create policy ops_visit_correction_decision_read on public.mzs_ops_visit_correction_decisions
 for select to authenticated using ((select public.is_admin()) or exists(
 select 1 from public.mzs_ops_visit_correction_requests r
 join public.mzs_ops_staff_visits v on v.id=r.visit_id
 where r.id=correction_id and v.profile_id=(select auth.uid()) and
 (select mzs_private.ops_can_work_on_property(v.property_id))));
create policy ops_visit_correction_decision_insert on public.mzs_ops_visit_correction_decisions
 for insert to authenticated with check ((select public.is_admin()) and decided_by=(select auth.uid()));
create function mzs_private.ops_validate_visit_correction_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare proposed public.mzs_ops_visit_correction_requests;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.decided_by is distinct from (select auth.uid()) then
 raise exception 'Group Admin must decide correction' using errcode='42501';end if;
 select * into proposed from public.mzs_ops_visit_correction_requests where id=new.correction_id for update;
 if not found then raise exception 'Correction request missing';end if;
 perform 1 from public.mzs_ops_staff_visits where id=proposed.visit_id for update;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=proposed.visit_id)
 then raise exception 'Visit has already been reviewed';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_decisions where correction_id=new.correction_id)
 then raise exception 'Correction already decided';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_correction_decision() from public,anon,authenticated,service_role;
create trigger ops_visit_correction_decision_guard before insert on public.mzs_ops_visit_correction_decisions
 for each row execute function mzs_private.ops_validate_visit_correction_decision();

-- If a correction is requested, the supervisor must resolve it before any time
-- review. Approved correction changes the REVIEWED working-time snapshot only,
-- not the immutable worker-submitted actual_minutes.
create or replace function mzs_private.ops_validate_visit_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit public.mzs_ops_staff_visits;
 corrected_minutes integer;
 requested uuid;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.reviewed_by is distinct from (select auth.uid())
 then raise exception 'Only active Group Administrator may review visits' using errcode='42501';end if;
 select * into visit from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Original visit not found';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=visit.id)
 then raise exception 'Visit already reviewed';end if;
 corrected_minutes:=visit.actual_minutes;
 select c.id into requested from public.mzs_ops_visit_correction_requests c where c.visit_id=visit.id;
 if requested is not null then
  if not exists(select 1 from public.mzs_ops_visit_correction_decisions x
   where x.correction_id=requested)
  then raise exception 'Pending staff correction must be decided before review';end if;
  select c.proposed_minutes into corrected_minutes
   from public.mzs_ops_visit_correction_requests c
   join public.mzs_ops_visit_correction_decisions x on x.correction_id=c.id
   where c.id=requested and x.decision='approved';
  corrected_minutes:=coalesce(corrected_minutes,visit.actual_minutes);
 end if;
 if new.decision='approved' and new.recharge_class='review_candidate' then
  if new.minimum_minutes is null or new.increment_minutes is null or
    new.minimum_minutes<0 or new.increment_minutes<=0 then
   raise exception 'Explicit per-visit billing rule required';end if;
  new.billable_minutes:=greatest(new.minimum_minutes,
     ((corrected_minutes+new.increment_minutes-1)/new.increment_minutes)*new.increment_minutes);
  if new.billable_minutes>2000 then raise exception 'Candidate billing duration exceeds limit';end if;
 else
  if new.minimum_minutes is not null or new.increment_minutes is not null then
   raise exception 'No billing rule allowed for internal or rejected time';end if;
  new.billable_minutes:=0;
 end if;
 return new;
end $fn$;

create table public.mzs_ops_maintenance_work_orders (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.mzs_ops_maintenance_tickets(id) on delete restrict,
 legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 supplier_relationship_id uuid not null references public.mzs_lease_relationships(id) on delete restrict,
 scope_of_work text not null check(length(btrim(scope_of_work)) between 10 and 2000 and scope_of_work !~ '[[:cntrl:]]'),
 quotation_reference text not null check(length(btrim(quotation_reference)) between 3 and 180 and quotation_reference !~ '[[:cntrl:]]'),
 approved_budget_net_cents bigint not null check(approved_budget_net_cents between 0 and 100000000000),
 approved_budget_vat_cents bigint not null check(approved_budget_vat_cents between 0 and 100000000000),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(approved_budget_net_cents+approved_budget_vat_cents>0),
 unique(ticket_id,quotation_reference)
);
alter table public.mzs_ops_maintenance_work_orders enable row level security;
revoke all on public.mzs_ops_maintenance_work_orders from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_work_orders to authenticated;
grant insert(ticket_id,legal_entity_id,supplier_relationship_id,scope_of_work,quotation_reference,approved_budget_net_cents,approved_budget_vat_cents)
 on public.mzs_ops_maintenance_work_orders to authenticated;
create policy ops_work_order_read on public.mzs_ops_maintenance_work_orders
 for select to authenticated using ((select public.is_admin()));
create policy ops_work_order_insert on public.mzs_ops_maintenance_work_orders
 for insert to authenticated with check ((select public.is_admin()) and created_by=(select auth.uid()));
create function mzs_private.ops_validate_maintenance_work_order()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets; stage text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.created_by is distinct from (select auth.uid()) then
  raise exception 'Admin-only internal work order' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Maintenance ticket missing';end if;
 select action into stage from public.mzs_ops_maintenance_events where ticket_id=ticket.id
  order by sequence_no desc limit 1;
 if stage not in ('triaged','scheduled','in_progress') or stage is null
 then raise exception 'Ticket must be triaged before work-order draft';end if;
 if not exists(select 1 from public.mzs_ops_property_entity_links l
  where l.property_id=ticket.property_id and l.legal_entity_id=new.legal_entity_id
  and l.relationship_type='payer' and l.effective_from<=current_date
  and (l.effective_until is null or l.effective_until>=current_date))
 then raise exception 'Verified property paying entity required';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_maintenance_work_order() from public,anon,authenticated,service_role;
create trigger ops_work_order_guard before insert on public.mzs_ops_maintenance_work_orders
 for each row execute function mzs_private.ops_validate_maintenance_work_order();

create table public.mzs_ops_maintenance_work_order_decisions (
 id uuid primary key default gen_random_uuid(),
 work_order_id uuid not null unique references public.mzs_ops_maintenance_work_orders(id) on delete restrict,
 decision text not null check (decision in ('authorized_internally','declined')),
 reason text not null check(length(btrim(reason)) between 8 and 1000 and reason !~ '[[:cntrl:]]'),
 decided_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 decided_at timestamptz not null default now()
);
alter table public.mzs_ops_maintenance_work_order_decisions enable row level security;
revoke all on public.mzs_ops_maintenance_work_order_decisions from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_work_order_decisions to authenticated;
grant insert(work_order_id,decision,reason) on public.mzs_ops_maintenance_work_order_decisions to authenticated;
create policy ops_order_decision_read on public.mzs_ops_maintenance_work_order_decisions
 for select to authenticated using ((select public.is_admin()));
create policy ops_order_decision_insert on public.mzs_ops_maintenance_work_order_decisions
 for insert to authenticated with check ((select public.is_admin()) and decided_by=(select auth.uid()));
create function mzs_private.ops_validate_order_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare work_order public.mzs_ops_maintenance_work_orders;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.decided_by is distinct from (select auth.uid()) then
 raise exception 'Admin authorization required' using errcode='42501';end if;
 select * into work_order from public.mzs_ops_maintenance_work_orders where id=new.work_order_id for update;
 if not found then raise exception 'Work order missing';end if;
 if exists(select 1 from public.mzs_ops_maintenance_work_order_decisions where work_order_id=work_order.id)
 then raise exception 'Work order already decided';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_order_decision() from public,anon,authenticated,service_role;
create trigger ops_order_decision_guard before insert on public.mzs_ops_maintenance_work_order_decisions
 for each row execute function mzs_private.ops_validate_order_decision();

comment on table public.mzs_ops_maintenance_work_orders is
 'Internal draft with explicit verified payer and supplier. Approved budget not money spent. No external vendor acceptance.';
comment on table public.mzs_ops_visit_correction_requests is
 'Immutable pre-review time correction proposed by its author or Group Admin, never overwrites submitted actual_minutes.';
commit;
