-- STAGING ONLY: first write-capable Property Operations slice.
-- Legal attribution is explicit and audited; never infer ownership from name.
-- This file is not applied to Production without a separate owner approval.
begin;

create table public.mzs_ops_property_entity_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
  legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('owner','payer','manager')),
  effective_from date not null,
  effective_until date,
  evidence_reference text not null check (
    length(btrim(evidence_reference)) between 6 and 500
    and evidence_reference !~ '[[:cntrl:]]'
  ),
  verified_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint mzs_ops_link_period check (
    effective_until is null or effective_until >= effective_from
  ),
  constraint mzs_ops_link_unique unique (
    property_id, legal_entity_id, relationship_type, effective_from
  )
);
create index mzs_ops_link_property ON public.mzs_ops_property_entity_links(property_id,effective_from desc);
create index mzs_ops_link_entity ON public.mzs_ops_property_entity_links(legal_entity_id,effective_from desc);

create table public.mzs_ops_property_entity_link_audit (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.mzs_ops_property_entity_links(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action='INSERT'),
  new_record jsonb not null,
  created_at timestamptz not null default now()
);
create index mzs_ops_link_audit_link_time on public.mzs_ops_property_entity_link_audit(link_id,created_at desc);
alter table public.mzs_ops_property_entity_links enable row level security;
alter table public.mzs_ops_property_entity_link_audit enable row level security;
revoke all on public.mzs_ops_property_entity_links from public,anon,authenticated,service_role;
revoke all on public.mzs_ops_property_entity_link_audit from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_ops_property_entity_link_audit_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_ops_property_entity_links,public.mzs_ops_property_entity_link_audit to authenticated;
-- Restrict who may provide each field. Actor and verification time come from trusted defaults.
grant insert(property_id,legal_entity_id,relationship_type,effective_from,effective_until,evidence_reference)
  on public.mzs_ops_property_entity_links to authenticated;
create policy mzs_ops_link_admin_read on public.mzs_ops_property_entity_links
  for select to authenticated using ((select public.is_admin()));
create policy mzs_ops_link_admin_insert on public.mzs_ops_property_entity_links
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and verified_by = (select auth.uid())
    and (select public.is_admin())
  );
create policy mzs_ops_link_audit_admin_read on public.mzs_ops_property_entity_link_audit
  for select to authenticated using ((select public.is_admin()));
-- No update or deletion yet: attribution history stays immutable in this first slice.
create or replace function mzs_private.mzs_ops_audit_property_entity_link()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
  if tg_op <> 'INSERT' or (select auth.uid()) is null
      or (select public.is_admin()) is distinct from true
      or new.verified_by is distinct from (select auth.uid())
  then
    raise exception 'Invalid verified property entity link' using errcode='42501';
  end if;
  insert into public.mzs_ops_property_entity_link_audit(
    link_id,actor_id,action,new_record
  ) values(new.id,(select auth.uid()),'INSERT',to_jsonb(new));
  return new;
end
$fn$;
revoke all on function mzs_private.mzs_ops_audit_property_entity_link()
  from public,anon,authenticated,service_role;
create trigger mzs_ops_link_audit_insert
after insert on public.mzs_ops_property_entity_links
for each row execute function mzs_private.mzs_ops_audit_property_entity_link();

comment on table public.mzs_ops_property_entity_links is
  'Explicit, immutable, dated administrative attribution. Never inferred from property owner_name.';
comment on table public.mzs_ops_property_entity_link_audit is
  'Append-only provenance for reviewed physical-property legal entity assignments.';
commit;
