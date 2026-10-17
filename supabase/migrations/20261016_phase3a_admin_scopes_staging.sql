-- MZS Group Phase 3A.1 | isolated Staging-first scope foundation
-- Additive only: no changes to profiles.role, legacy is_admin(), projects or existing grants.
begin;
create table if not exists public.mzs_admin_scope_assignments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 department text not null check (department in ('estates','capital')),
 is_active boolean not null default false,
 assigned_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,department)
);
create index if not exists mzs_admin_scope_assignments_department_idx
 on public.mzs_admin_scope_assignments(department,user_id) where is_active;
alter table public.mzs_admin_scope_assignments enable row level security;
revoke all on public.mzs_admin_scope_assignments from anon;
grant select,insert,update,delete on public.mzs_admin_scope_assignments to authenticated;
create policy mzs_scope_group_admin_manage on public.mzs_admin_scope_assignments
 for all to authenticated using ((select public.is_admin()))
 with check ((select public.is_admin()) and assigned_by=(select auth.uid()));
create policy mzs_scope_self_read on public.mzs_admin_scope_assignments
 for select to authenticated using (user_id=(select auth.uid()));
-- Department assignment does not alter any preexisting policies. A user must
-- be active and explicitly assigned before any future department data is visible.
create or replace function public.mzs_has_department_scope(p_department text)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_department in ('estates','capital') and exists (
  select 1 from public.profiles p
  join public.mzs_admin_scope_assignments a on a.user_id=p.id
  where p.id=(select auth.uid())
    and p.is_active=true and a.department=p_department and a.is_active=true
 )
$$;
revoke all on function public.mzs_has_department_scope(text) from public,anon;
grant execute on function public.mzs_has_department_scope(text) to authenticated;
commit;