-- Staging only. Targeted covering indexes for the 25 MZS Ops FK performance advisories.
-- These are non-destructive; all Property Operations tables currently contain only test-free state.
begin;
create index if not exists ops_fka_01 on public.mzs_ops_expense_correction_decisions(decided_by);
create index if not exists ops_fka_02 on public.mzs_ops_expense_correction_requests(requested_by);
create index if not exists ops_fka_03 on public.mzs_ops_expense_documents(uploaded_by);
create index if not exists ops_fka_04 on public.mzs_ops_expense_draft_audit(actor_id);
create index if not exists ops_fka_05 on public.mzs_ops_expense_draft_audit(draft_id);
create index if not exists ops_fka_06 on public.mzs_ops_expense_drafts(created_by);
create index if not exists ops_fka_07 on public.mzs_ops_expense_drafts(supplier_relationship_id);
create index if not exists ops_fka_08 on public.mzs_ops_expense_replacements(linked_by);
create index if not exists ops_fka_09 on public.mzs_ops_expense_review_events(actor_id);
create index if not exists ops_fka_10 on public.mzs_ops_maintenance_events(actor_id);
create index if not exists ops_fka_11 on public.mzs_ops_maintenance_photos(created_by);
create index if not exists ops_fka_12 on public.mzs_ops_maintenance_tickets(reported_by);
create index if not exists ops_fka_13 on public.mzs_ops_maintenance_tickets(unit_id);
create index if not exists ops_fka_14 on public.mzs_ops_maintenance_work_order_decisions(decided_by);
create index if not exists ops_fka_15 on public.mzs_ops_maintenance_work_orders(created_by);
create index if not exists ops_fka_16 on public.mzs_ops_maintenance_work_orders(legal_entity_id);
create index if not exists ops_fka_17 on public.mzs_ops_maintenance_work_orders(supplier_relationship_id);
create index if not exists ops_fka_18 on public.mzs_ops_property_entity_link_audit(actor_id);
create index if not exists ops_fka_19 on public.mzs_ops_property_entity_links(verified_by);
create index if not exists ops_fka_20 on public.mzs_ops_staff_scope_events(property_id);
create index if not exists ops_fka_21 on public.mzs_ops_staff_scope_events(recorded_by);
create index if not exists ops_fka_22 on public.mzs_ops_staff_visits(unit_id);
create index if not exists ops_fka_23 on public.mzs_ops_visit_correction_decisions(decided_by);
create index if not exists ops_fka_24 on public.mzs_ops_visit_correction_requests(requested_by);
create index if not exists ops_fka_25 on public.mzs_ops_visit_reviews(reviewed_by);
commit;
