-- STAGING ONLY: replace security-definer directory views with SECURITY INVOKER
-- views calling strictly-scoped helper functions in the unexposed private schema.
begin;
create function mzs_private.ops_staff_property_labels()
returns table (id uuid,name text,address text)
language sql security definer stable set search_path='' as $fn$
 select p.id,p.name,p.address
 from public.mzs_estate_properties p
 where mzs_private.ops_can_work_on_property(p.id)
$fn$;
create function mzs_private.ops_staff_unit_labels()
returns table (id uuid,property_id uuid,address text)
language sql security definer stable set search_path='' as $fn$
 select u.id,u.property_id,u.address
 from public.mzs_estate_units u
 where mzs_private.ops_can_work_on_property(u.property_id)
$fn$;
revoke all on function mzs_private.ops_staff_property_labels()
 from public,anon,authenticated,service_role;
revoke all on function mzs_private.ops_staff_unit_labels()
 from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_staff_property_labels() to authenticated;
grant execute on function mzs_private.ops_staff_unit_labels() to authenticated;

create or replace view public.mzs_ops_staff_property_directory
 with (security_invoker=true,security_barrier=true) as
 select p.id,p.name,p.address from mzs_private.ops_staff_property_labels() p;
create or replace view public.mzs_ops_staff_unit_directory
 with (security_invoker=true,security_barrier=true) as
 select u.id,u.property_id,u.address from mzs_private.ops_staff_unit_labels() u;
revoke all on public.mzs_ops_staff_property_directory from public,anon,authenticated,service_role;
revoke all on public.mzs_ops_staff_unit_directory from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_property_directory,public.mzs_ops_staff_unit_directory
 to authenticated;

comment on view public.mzs_ops_staff_property_directory is
 'Security-invoker narrow directory. Every property row comes from an authenticated current-profile scope check in a private helper.';
comment on view public.mzs_ops_staff_unit_directory is
 'Security-invoker narrow unit names. Never exposes tenant/owner details in full physical registers.';
commit;
