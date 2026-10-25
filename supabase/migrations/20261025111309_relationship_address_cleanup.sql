begin;
-- Keep existing free-form addresses and historical invoice/contract snapshots intact.
alter table public.mzs_lease_relationships add column billing_address jsonb not null default '{}'::jsonb;
create function mzs_private.valid_relationship_address(a jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; max_length integer;
begin
 if jsonb_typeof(a)<>'object' then return false; end if;
 for k,v in select * from jsonb_each(a) loop
  max_length:=case k when 'street' then 200 when 'house_number' then 30 when 'addition' then 100 when 'postal_code' then 30 when 'city' then 120 when 'region' then 120 when 'country' then 120 end;
  if max_length is null or jsonb_typeof(v)<>'string' or length(v#>>'{}')>max_length or (v#>>'{}') ~ E'[\r\n]' then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function mzs_private.valid_relationship_address(jsonb) from public,anon,authenticated,service_role;
grant execute on function mzs_private.valid_relationship_address(jsonb) to authenticated;
alter table public.mzs_lease_relationships add constraint relationship_billing_address_valid check(mzs_private.valid_relationship_address(billing_address));
create function mzs_private.sync_relationship_address() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.billing_address<>'{}'::jsonb then
  new.address:=concat_ws(E'\n',nullif(concat_ws(' ',nullif(btrim(new.billing_address->>'street'),''),nullif(btrim(new.billing_address->>'house_number'),'')),''),nullif(btrim(new.billing_address->>'addition'),''),nullif(concat_ws(' ',nullif(btrim(new.billing_address->>'postal_code'),''),nullif(btrim(new.billing_address->>'city'),'')),''),nullif(btrim(new.billing_address->>'region'),''),nullif(btrim(new.billing_address->>'country'),''));
 elsif tg_op='UPDATE' and old.billing_address<>'{}'::jsonb then new.address:='';
 end if;
 return new;
end $$;
revoke all on function mzs_private.sync_relationship_address() from public,anon,authenticated,service_role;
create trigger sync_relationship_address before insert or update on public.mzs_lease_relationships for each row execute function mzs_private.sync_relationship_address();

create table mzs_private.relationship_deletions(id uuid primary key default gen_random_uuid(),actor_id uuid not null,target_kind text not null,target_id uuid not null,deleted_at timestamptz not null default now());
alter table mzs_private.relationship_deletions enable row level security;
revoke all on mzs_private.relationship_deletions from public,anon,authenticated,service_role;

-- Fail closed for current and future dependencies, including CASCADE/SET NULL business rows.
-- Only the named account-lifecycle rows may be removed with an unused account.
create function mzs_private.relationship_delete_blockers(parent regclass, ids uuid[], account_cleanup boolean) returns text[] language plpgsql security invoker set search_path='' as $$
declare f record; found_rows boolean; blockers text[]:='{}'; ref text; label text;
begin
 if coalesce(cardinality(ids),0)=0 then return blockers; end if;
 for f in select n.nspname,c.relname,a.attname,k.confdeltype from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] where k.contype='f' and k.confrelid=parent loop
  ref:=f.nspname||'.'||f.relname||'.'||f.attname;
  if account_cleanup and ((f.nspname='auth' and f.confdeltype='c') or ref=any(array[
   'public.profiles.id','public.project_access.user_id','public.offering_access.user_id','public.login_history.user_id',
   'public.mzs_member_contact_details.user_id','public.mzs_member_companies.user_id','public.mzs_mail_outbox.user_id',
   'public.mzs_visitor_activity.user_id','public.invitation_activation_proofs.user_id','public.mzs_auth_action_proofs.user_id',
   'public.access_requests.auth_user_id','public.access_request_access_plans.applied_user_id','public.mzs_lease_relationships.profile_id',
   'public.access_invitations.request_id','public.access_request_access_plans.request_id'
  ])) then continue; end if;
  execute format('select exists(select 1 from %I.%I where %I=any($1))',f.nspname,f.relname,f.attname) into found_rows using ids;
  if found_rows then
   label:=case f.relname when 'mzs_lease_contracts' then 'Rental contracts' when 'mzs_lease_issuers' then 'Issuing entities' when 'mzs_lease_invoices' then 'Issued invoices' when 'mzs_lease_invoice_drafts' then 'Invoice review history' when 'mzs_lease_payments' then 'Payments' when 'rental_bookings' then 'Bookings' when 'responses' then 'Submitted responses' when 'mzs_capital_requests' then 'Capital requests' when 'mzs_capital_client_access' then 'Capital access' when 'mzs_admin_scope_assignments' then 'Administrative permissions' when 'rental_cancellation_requests' then 'Cancellation requests' else 'Other linked history or settings' end;
   blockers:=array_append(blockers,label);
  end if;
 end loop;
 return blockers;
end $$;
revoke all on function mzs_private.relationship_delete_blockers(regclass,uuid[],boolean) from public,anon,authenticated,service_role;

create function mzs_private.relationship_deletion_plan(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb; person_ids uuid[]; company_ids uuid[]; request_ids uuid[]; blockers text[]:='{}'; cleanup jsonb:='{}'; confirmation text; version_source text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_kind='relationship' then
  select to_jsonb(r) into target from public.mzs_lease_relationships r where r.id=p_id;
  if target is null then raise exception 'Relationship no longer exists' using errcode='P0002'; end if;
  if target->>'kind'='person' and target->>'profile_id' is not null then blockers:=array_append(blockers,'Use Delete client account for this linked person'); end if;
  blockers:=blockers||mzs_private.relationship_delete_blockers('public.mzs_lease_relationships'::regclass,array[p_id],false);
  confirmation:=target->>'name';version_source:=target::text;
 elsif p_kind='account' then
  select to_jsonb(p) into target from public.profiles p where p.id=p_id;
  if target is null then raise exception 'Account no longer exists' using errcode='P0002'; end if;
  if p_id=auth.uid() or target->>'role' not in ('client','partner') then blockers:=array_append(blockers,'Your own account and administrator accounts cannot be deleted here'); end if;
  select array_agg(id order by id) into person_ids from public.mzs_lease_relationships where profile_id=p_id and kind='person';
  if exists(select 1 from public.mzs_lease_relationships where profile_id=p_id and kind='company') then blockers:=array_append(blockers,'Unlink the contact account from its companies first'); end if;
  select array_agg(id order by id) into company_ids from public.mzs_member_companies where user_id=p_id;
  blockers:=blockers||mzs_private.relationship_delete_blockers('public.profiles'::regclass,array[p_id],true)||mzs_private.relationship_delete_blockers('auth.users'::regclass,array[p_id],true)||mzs_private.relationship_delete_blockers('public.mzs_lease_relationships'::regclass,person_ids,false)||mzs_private.relationship_delete_blockers('public.mzs_member_companies'::regclass,company_ids,false);
  if exists(select 1 from storage.objects where owner_id=p_id::text or owner=p_id) then blockers:=array_append(blockers,'Owned files must be reviewed before deleting this account'); end if;
  if exists(select 1 from public.access_invitations i join public.access_requests r on r.id=i.request_id where r.auth_user_id=p_id and i.auth_user_id is not null and i.auth_user_id<>p_id) then blockers:=array_append(blockers,'An access request is linked to another account'); end if;
  select array_agg(id order by id) into request_ids from public.access_requests where auth_user_id=p_id;
  blockers:=blockers||mzs_private.relationship_delete_blockers('public.access_requests'::regclass,request_ids,true);
  if exists(select 1 from public.access_request_access_plans where applied_user_id=p_id and not (request_id=any(coalesce(request_ids,'{}'::uuid[])))) then blockers:=array_append(blockers,'An approval belongs to another registration'); end if;
  if exists(select 1 from public.mzs_mail_outbox where (user_id=p_id or idempotency_key like 'application:'||p_id::text||':%') and status='sending') then blockers:=array_append(blockers,'A notification is being delivered; wait until delivery is resolved'); end if;
  cleanup:=jsonb_build_object('person_records',coalesce(cardinality(person_ids),0),'declared_companies',coalesce(cardinality(company_ids),0),'project_access',(select count(*) from public.project_access where user_id=p_id),'offering_access',(select count(*) from public.offering_access where user_id=p_id),'access_requests',(select count(*) from public.access_requests where auth_user_id=p_id));
  confirmation:=coalesce(nullif(target->>'email',''),target->>'full_name');
  version_source:=target::text||coalesce((select jsonb_agg(to_jsonb(r) order by r.id)::text from public.mzs_lease_relationships r where r.profile_id=p_id),'[]')||cleanup::text;
 else raise exception 'Invalid deletion target' using errcode='22023'; end if;
 select coalesce(array_agg(distinct b order by b),'{}'::text[]) into blockers from unnest(blockers) b;
 return jsonb_build_object('kind',p_kind,'id',p_id,'name',coalesce(target->>'name',target->>'full_name',target->>'email'),'confirmation',confirmation,'revision',md5(version_source||blockers::text),'blockers',to_jsonb(blockers),'cleanup',cleanup);
end $$;
revoke all on function mzs_private.relationship_deletion_plan(text,uuid) from public,anon,authenticated,service_role;
grant execute on function mzs_private.relationship_deletion_plan(text,uuid) to authenticated;
create function public.mzs_relationship_deletion_plan(p_kind text,p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select mzs_private.relationship_deletion_plan(p_kind,p_id)$$;
revoke all on function public.mzs_relationship_deletion_plan(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_relationship_deletion_plan(text,uuid) to authenticated;

create function mzs_private.delete_relationship(p_kind text,p_id uuid,p_revision text,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare plan jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_kind='account' then
  perform 1 from auth.users where id=p_id for update;
  perform 1 from public.profiles where id=p_id for update;
  perform 1 from public.mzs_lease_relationships where profile_id=p_id order by id for update;
  perform 1 from public.mzs_member_companies where user_id=p_id order by id for update;
  perform 1 from public.access_requests where auth_user_id=p_id order by id for update;
  perform 1 from public.mzs_mail_outbox where user_id=p_id or idempotency_key like 'application:'||p_id::text||':%' order by id for update;
 elsif p_kind='relationship' then perform 1 from public.mzs_lease_relationships where id=p_id for update;
 else raise exception 'Invalid deletion target' using errcode='22023'; end if;
 plan:=mzs_private.relationship_deletion_plan(p_kind,p_id);
 if jsonb_array_length(plan->'blockers')>0 then raise exception 'Linked history prevents deletion. Review the deletion check.' using errcode='23503'; end if;
 if p_revision is distinct from plan->>'revision' then raise exception 'The relationship changed. Run the deletion check again.' using errcode='40001'; end if;
 if p_confirmation is null or p_confirmation='' or p_confirmation is distinct from plan->>'confirmation' then raise exception 'Confirmation does not match' using errcode='22023'; end if;
 if p_kind='account' then
  -- Parent locks serialize new FK-backed business references with this deletion.
  -- Revoke refresh sessions in the same transaction. Remaining JWTs have no profile or grants.
  delete from public.mzs_mail_outbox where idempotency_key like 'application:'||p_id::text||':%' and status in ('pending','failed');
  delete from auth.refresh_tokens where user_id=p_id::text;
  delete from auth.sessions where user_id=p_id;
  delete from public.access_invitations where auth_user_id=p_id or request_id in(select id from public.access_requests where auth_user_id=p_id);
  delete from public.access_requests where auth_user_id=p_id;
  delete from public.mzs_lease_relationships where profile_id=p_id and kind='person';
  delete from auth.users where id=p_id;
  if exists(select 1 from public.profiles where id=p_id) then raise exception 'Account cleanup incomplete'; end if;
 else delete from public.mzs_lease_relationships where id=p_id;
 end if;
 insert into mzs_private.relationship_deletions(actor_id,target_kind,target_id) values(auth.uid(),p_kind,p_id);
end $$;
revoke all on function mzs_private.delete_relationship(text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.delete_relationship(text,uuid,text,text) to authenticated;
create function public.mzs_delete_relationship(p_kind text,p_id uuid,p_revision text,p_confirmation text) returns void language sql security invoker set search_path='' as $$select mzs_private.delete_relationship(p_kind,p_id,p_revision,p_confirmation)$$;
revoke all on function public.mzs_delete_relationship(text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_delete_relationship(text,uuid,text,text) to authenticated;
commit;
