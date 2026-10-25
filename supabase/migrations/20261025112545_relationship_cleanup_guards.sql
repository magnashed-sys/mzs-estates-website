-- The audit is deliberately private; only the guarded definer writes it.
create policy relationship_deletions_private on mzs_private.relationship_deletions for all to public using(false) with check(false);
-- Force account removal through the checked, transactional cleanup operation.
-- Existing sign-in, profile editing and active/inactive controls retain their grants.
revoke delete on public.profiles,public.mzs_lease_relationships from authenticated,anon;
