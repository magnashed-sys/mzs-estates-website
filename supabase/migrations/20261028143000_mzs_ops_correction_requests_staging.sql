-- STAGING ONLY: append-only proposed corrections after supplier cost review.
-- Does NOT mutate issued/sent invoices, payments, original evidence or existing drafts.
-- An unresolved correction excludes that approved cost from accountant-ready exports.
begin;
create table public.mzs_ops_expense_correction_requests (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null unique references public.mzs_ops_expense_drafts(id) on delete restrict,
 reason text not null check (length(btrim(reason)) between 10 and 1000),
 proposed_description text not null check (length(btrim(proposed_description)) between 2 and 500
   and proposed_description !~ '[[:cntrl:]]'),
 proposed_net_cents bigint not null check(proposed_net_cents between 0 and 100000000000),
 proposed_vat_cents bigint not null check(proposed_vat_cents between 0 and 100000000000),
 proposed_allocations jsonb not null,
 status text not null default 'proposed' check(status='proposed'),
 requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(proposed_net_cents + proposed_vat_cents > 0)
);
create index ops_correction_requested on public.mzs_ops_expense_correction_requests(created_at desc);
alter table public.mzs_ops_expense_correction_requests enable row level security;
revoke all on public.mzs_ops_expense_correction_requests from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_correction_requests to authenticated;
grant insert(draft_id,reason,proposed_description,proposed_net_cents,proposed_vat_cents,proposed_allocations)
 on public.mzs_ops_expense_correction_requests to authenticated;
create policy ops_correction_admin_read on public.mzs_ops_expense_correction_requests
 for select to authenticated using((select public.is_admin()));
create policy ops_correction_admin_insert on public.mzs_ops_expense_correction_requests
 for insert to authenticated with check((select public.is_admin())
   and requested_by=(select auth.uid()));

create function mzs_private.ops_validate_correction_request()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
 d public.mzs_ops_expense_drafts;
 current_review text;
 a jsonb;
 sum_net bigint:=0;
 sum_vat bigint:=0;
 count_all integer:=0;
 count_null integer:=0;
 used_units uuid[]:=array[]::uuid[];
 unit_uuid uuid;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
     or new.requested_by is distinct from (select auth.uid())
 then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into d from public.mzs_ops_expense_drafts where id=new.draft_id for update;
 if not found then raise exception 'Unknown purchase cost draft';end if;
 select action into current_review
 from public.mzs_ops_expense_review_events
 where draft_id=new.draft_id order by sequence_no desc limit 1;
 if current_review not in ('approved','rejected') or current_review is null
 then raise exception 'Only completed reviews may receive a correction request';end if;
 if jsonb_typeof(new.proposed_allocations) <> 'array'
   or jsonb_array_length(new.proposed_allocations) not between 1 and 100
 then raise exception 'Invalid proposed allocation';end if;
 for a in select value from jsonb_array_elements(new.proposed_allocations) loop
   if jsonb_typeof(a)<>'object'
     or jsonb_typeof(a->'net_cents') is distinct from 'number'
     or jsonb_typeof(a->'vat_cents') is distinct from 'number'
     or (a->>'net_cents') !~ '^[0-9]{1,12}$'
     or (a->>'vat_cents') !~ '^[0-9]{1,12}$'
   then raise exception 'Correction allocation amounts must be integer cents';end if;
   sum_net:=sum_net+(a->>'net_cents')::bigint;
   sum_vat:=sum_vat+(a->>'vat_cents')::bigint;
   count_all:=count_all+1;
   if (a->'unit_id') is null or a->'unit_id'='null'::jsonb then
     count_null:=count_null+1;
   else
     if jsonb_typeof(a->'unit_id') <> 'string'
       or (a->>'unit_id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
     then raise exception 'Invalid correction unit ID';end if;
     unit_uuid:=(a->>'unit_id')::uuid;
     if unit_uuid=any(used_units) or not exists(
       select 1 from public.mzs_estate_units u
       where u.id=unit_uuid and u.property_id=d.property_id
     ) then raise exception 'Invalid or duplicate correction unit';end if;
     used_units:=array_append(used_units,unit_uuid);
   end if;
 end loop;
 if sum_net<>new.proposed_net_cents or sum_vat<>new.proposed_vat_cents
   or (count_null>0 and (count_all<>1 or count_null<>1))
 then raise exception 'Correction amounts do not reconcile';end if;
 if new.proposed_description=d.description and new.proposed_net_cents=d.net_cents
   and new.proposed_vat_cents=d.vat_cents and new.proposed_allocations=d.allocations
 then raise exception 'Correction must contain a change';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_correction_request()
 from public,anon,authenticated,service_role;
create trigger ops_correction_validate_insert
 before insert on public.mzs_ops_expense_correction_requests
 for each row execute function mzs_private.ops_validate_correction_request();

comment on table public.mzs_ops_expense_correction_requests is
 'Append-only proposed correction, not a replacement invoice or approved financial posting. Do not include unresolved original in final accountant export.';
commit;
