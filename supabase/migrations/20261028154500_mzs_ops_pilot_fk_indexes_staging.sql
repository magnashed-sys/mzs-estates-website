-- STAGING ONLY: indexes for all eight previously unindexed pilot foreign keys.
-- Additive and non-destructive; no access, invoice, booking or Production changes.
begin;
create index if not exists ops_pilot_access_profile_fk on public.mzs_ops_pilot_access_events(profile_id);
create index if not exists ops_pilot_access_recorded_fk on public.mzs_ops_pilot_access_events(recorded_by);
create index if not exists ops_pilot_run_events_recorded_fk on public.mzs_ops_pilot_run_events(recorded_by);
create index if not exists ops_pilot_runs_created_fk on public.mzs_ops_pilot_runs(created_by);
create index if not exists ops_pilot_tickets_property_fk on public.mzs_ops_pilot_tickets(property_id);
create index if not exists ops_pilot_tickets_reporter_fk on public.mzs_ops_pilot_tickets(reported_by);
create index if not exists ops_pilot_visits_property_fk on public.mzs_ops_pilot_visits(property_id);
create index if not exists ops_pilot_visits_submitter_fk on public.mzs_ops_pilot_visits(submitted_by);
commit;
