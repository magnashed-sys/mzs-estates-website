-- A personal presentation preference, including scoped administrators.
-- No role, department, document or financial permissions are changed.
begin;
alter policy admin_language_read on public.mzs_admin_language_preferences
  using (user_id = (select auth.uid()));
alter policy admin_language_insert on public.mzs_admin_language_preferences
  with check (user_id = (select auth.uid()));
alter policy admin_language_update on public.mzs_admin_language_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
comment on table public.mzs_admin_language_preferences is
  'Own-account English/Spanish admin presentation preference; never an authorization source.';
commit;
