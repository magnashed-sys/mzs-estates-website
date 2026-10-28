-- STAGING ONLY: resolve a reviewed correction proposal without altering original records.
-- 'declined' reaffirms the original source. 'replacement_required' keeps the
-- original out of the approved cost export until new supporting evidence is reviewed.
begin;
create table public.mzs_ops_expense_correction_decisions(
 id uuid primary key default gen_random_uuid(),
 correction_id uuid not null unique
  references public.mzs_ops_expense_correction_requests(id) on delete restrict,
 decision text not null check(decision in ('declined','replacement_required')),
 reason text not null check(length(btrim(reason)) between 8 and 1000
   and reason !~ '[[:cntrl:]]'),
 decided_by uuid not null default auth.uid()
  references public.profiles(id) on delete restrict,
 decided_at timestamptz not null default now()
);
create index ops_correction_decisions_date
 on public.mzs_ops_expense_correction_decisions(decided_at desc);
alter table public.mzs_ops_expense_correction_decisions enable row level security;
revoke all on public.mzs_ops_expense_correction_decisions
 from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_correction_decisions to authenticated;
grant insert(correction_id,decision,reason)
 on public.mzs_ops_expense_correction_decisions to authenticated;
create policy ops_correction_decision_admin_read
 on public.mzs_ops_expense_correction_decisions
 for select to authenticated using((select public.is_admin()));
create policy ops_correction_decision_admin_insert
 on public.mzs_ops_expense_correction_decisions
 for insert to authenticated with check((select public.is_admin())
   and decided_by=(select auth.uid()));
create function mzs_private.ops_validate_correction_decision()
returns trigger language plpgsql security definer set search_path='' as $body$
declare request public.mzs_ops_expense_correction_requests;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.decided_by is distinct from (select auth.uid())
 then raise exception 'Active Group Admin required' using errcode='42501';end if;
 select * into request
 from public.mzs_ops_expense_correction_requests
 where id=new.correction_id for update;
 if not found then raise exception 'Unknown correction proposal';end if;
 if request.status<>'proposed' then
  raise exception 'Correction proposal status has changed';end if;
 if exists(select 1 from public.mzs_ops_expense_correction_decisions
  where correction_id=request.id)
 then raise exception 'Correction has already been resolved';end if;
 return new;
end $body$;
revoke all on function mzs_private.ops_validate_correction_decision()
 from public,anon,authenticated,service_role;
create trigger ops_correction_decision_validate
 before insert on public.mzs_ops_expense_correction_decisions
 for each row execute function mzs_private.ops_validate_correction_decision();
comment on table public.mzs_ops_expense_correction_decisions is
 'Staging-only immutable review decision; replacement_required is not approval or changed financial posting.';
commit;
