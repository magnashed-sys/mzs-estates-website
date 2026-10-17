-- Phase 3A.2 Staging only: audited administrator scope assignments.
begin;
create table if not exists public.mzs_admin_scope_audit (
 id bigint generated always as identity primary key,
 assignment_id uuid not null,
 target_user_id uuid not null,
 department text not null,
 old_active boolean,
 new_active boolean not null,
 changed_by uuid not null,
 changed_at timestamptz not null default now()
);
alter table public.mzs_admin_scope_audit enable row level security;
revoke all on public.mzs_admin_scope_audit from public, anon, authenticated;
grant select on public.mzs_admin_scope_audit to authenticated;
create policy mzs_scope_audit_group_read on public.mzs_admin_scope_audit
 for select to authenticated using ((select public.is_admin()));
-- Remove direct writes. Admin operators must use an authenticated, audited RPC.
drop policy if exists mzs_scope_group_admin_manage on public.mzs_admin_scope_assignments;
revoke insert,update,delete on public.mzs_admin_scope_assignments from authenticated;
create policy mzs_scope_group_admin_read on public.mzs_admin_scope_assignments
 for select to authenticated using ((select public.is_admin()));
create or replace function public.mzs_set_admin_department_scope(
 p_target_user uuid, p_department text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid := auth.uid(); v_prev boolean; v_id uuid;
begin
 if v_actor is null or not public.is_admin() then raise exception 'Unauthorized'; end if;
 if p_target_user is null or p_department not in ('estates','capital') or p_enabled is null
 then raise exception 'Invalid scope assignment'; end if;
 if p_target_user = v_actor then raise exception 'Self-assignment is not permitted'; end if;
 if not exists (select 1 from public.profiles p where p.id=p_target_user and p.is_active=true)
 then raise exception 'Target account must be active'; end if;
 -- Department operators never inherit the legacy global admin role.
 if exists (select 1 from public.profiles p where p.id=p_target_user and p.role='admin')
 then raise exception 'Legacy administrators are already globally privileged'; end if;
 select id,is_active into v_id,v_prev from public.mzs_admin_scope_assignments
 where user_id=p_target_user and department=p_department for update;
 if v_id is null then
   if p_enabled = false then return false; end if;
   insert into public.mzs_admin_scope_assignments(user_id,department,is_active,assigned_by)
   values(p_target_user,p_department,true,v_actor) returning id into v_id;
 else
   if v_prev=p_enabled then return false; end if;
   update public.mzs_admin_scope_assignments set is_active=p_enabled,assigned_by=v_actor,updated_at=now()
   where id=v_id;
 end if;
 insert into public.mzs_admin_scope_audit(assignment_id,target_user_id,department,old_active,new_active,changed_by)
 values(v_id,p_target_user,p_department,v_prev,p_enabled,v_actor);
 return true;
end;
$$;
revoke all on function public.mzs_set_admin_department_scope(uuid,text,boolean) from public,anon;
grant execute on function public.mzs_set_admin_department_scope(uuid,text,boolean) to authenticated;
commit;