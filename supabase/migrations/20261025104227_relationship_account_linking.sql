-- Linking a previously offline relationship exposes its activated contracts.
-- An account already frozen on a contract always remains authoritative.
create or replace function mzs_private.member_relationship_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member_id uuid:=auth.uid(); result jsonb;
begin
 if member_id is null or not exists(select 1 from public.profiles where id=member_id and is_active=true and role in ('client','partner')) then
  raise exception 'An active client or partner account is required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'companies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'address',r.address) order by r.name,r.id)
    from public.mzs_lease_relationships r where r.kind='company' and r.profile_id=member_id),'[]'::jsonb),
  'contracts',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'title',c.title,'status',c.status,'lease_start',c.lease_start,'lease_end',c.lease_end,
    'tenant_name',c.tenant_name,'issuer_name',c.issuer_name,
    'units',coalesce((select jsonb_agg(u.address order by u.address,u.id) from public.mzs_estate_units u where u.id=any(c.unit_ids)),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.number,'issued_on',i.issued_on,'due_date',i.due_date,'total',i.total,
       'outstanding',i.total-coalesce((select sum(p.amount) from public.mzs_lease_payments p where p.invoice_id=i.id and p.reversed_at is null),0)) order by i.issued_on desc,i.number)
      from public.mzs_lease_invoices i where i.contract_id=c.id),'[]'::jsonb)
   ) order by c.lease_start desc,c.id) from public.mzs_lease_contracts c where (c.tenant_profile_id=member_id or (c.tenant_profile_id is null and exists(select 1 from public.mzs_lease_relationships r where r.id=c.tenant_relationship_id and r.profile_id=member_id))) and c.status in ('active','stopped')),'[]'::jsonb)
 ) into result;
 return result;
end $$;
