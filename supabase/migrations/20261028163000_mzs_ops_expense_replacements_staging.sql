-- STAGING ONLY: append-only connection between an authorised correction and a newly approved supplier document.
-- Does not overwrite an existing bill, register payment, create customer invoices, or decide tax.
begin;
create table public.mzs_ops_expense_replacements (
 id uuid primary key default gen_random_uuid(),
 correction_id uuid not null unique
  references public.mzs_ops_expense_correction_requests(id) on delete restrict,
 replacement_draft_id uuid not null unique
  references public.mzs_ops_expense_drafts(id) on delete restrict,
 verification_note text not null check(length(btrim(verification_note)) between 12 and 1000
  and verification_note !~ '[[:cntrl:]]'),
 linked_by uuid not null default auth.uid()
  references public.profiles(id) on delete restrict,
 linked_at timestamptz not null default now()
);
create index ops_expense_replacement_new_draft on public.mzs_ops_expense_replacements(replacement_draft_id);
alter table public.mzs_ops_expense_replacements enable row level security;
revoke all on public.mzs_ops_expense_replacements from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_replacements to authenticated;
grant insert(correction_id,replacement_draft_id,verification_note)
 on public.mzs_ops_expense_replacements to authenticated;
create policy ops_replacement_admin_read on public.mzs_ops_expense_replacements
 for select to authenticated using ((select public.is_admin()));
create policy ops_replacement_admin_insert on public.mzs_ops_expense_replacements
 for insert to authenticated with check(
  (select public.is_admin()) and linked_by=(select auth.uid())
 );

create function mzs_private.ops_verify_expense_replacement()
returns trigger language plpgsql security definer set search_path='' as $body$
declare
 correction public.mzs_ops_expense_correction_requests;
 decision text;
 original public.mzs_ops_expense_drafts;
 new_draft public.mzs_ops_expense_drafts;
 origin_review text;
 new_review text;
begin
 if (select auth.uid()) is null
    or (select public.is_admin()) is distinct from true
    or new.linked_by is distinct from (select auth.uid())
 then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into correction from public.mzs_ops_expense_correction_requests
  where id=new.correction_id for update;
 if not found then raise exception 'Correction proposal not found';end if;
 select d.decision into decision
 from public.mzs_ops_expense_correction_decisions d
 where d.correction_id=correction.id;
 if decision is distinct from 'replacement_required'
 then raise exception 'Correction must require replacement';end if;

 -- Lock both source invoice rows in deterministic UUID order to prevent races.
 perform 1 from public.mzs_ops_expense_drafts
 where id in (correction.draft_id,new.replacement_draft_id) order by id for update;
 select * into original from public.mzs_ops_expense_drafts where id=correction.draft_id;
 select * into new_draft from public.mzs_ops_expense_drafts where id=new.replacement_draft_id;
 if new_draft.id is null or original.id is null or original.id=new_draft.id
 then raise exception 'Original and replacement must be distinct valid drafts';end if;
 if original.property_id is distinct from new_draft.property_id
    or original.legal_entity_id is distinct from new_draft.legal_entity_id
    or original.supplier_relationship_id is distinct from new_draft.supplier_relationship_id
 then raise exception 'Replacement must use exact property, issuer and supplier';end if;
 if upper(btrim(original.supplier_invoice_number)) =
    upper(btrim(new_draft.supplier_invoice_number))
 then raise exception 'New supplier corrective invoice reference required';end if;

 select r.action into origin_review from public.mzs_ops_expense_review_events r
 where r.draft_id=original.id order by r.sequence_no desc limit 1;
 select r.action into new_review from public.mzs_ops_expense_review_events r
 where r.draft_id=new_draft.id order by r.sequence_no desc limit 1;
 if origin_review not in ('approved','rejected') or new_review is distinct from 'approved'
 then raise exception 'Both originals must be reviewed; replacement must be approved';end if;
 if not exists(select 1 from public.mzs_ops_expense_documents e where e.draft_id=new_draft.id)
 then raise exception 'Replacement needs its own original supplier document';end if;
 if exists(select 1 from public.mzs_ops_expense_correction_requests c
   where c.draft_id=new_draft.id)
 then raise exception 'Cannot link a replacement that itself requires correction';end if;
 if exists(select 1 from public.mzs_ops_expense_replacements r
   where r.correction_id=correction.id or r.replacement_draft_id=new_draft.id)
 then raise exception 'Replacement already linked';end if;
 return new;
end $body$;
revoke all on function mzs_private.ops_verify_expense_replacement()
 from public,anon,authenticated,service_role;
create trigger ops_expense_replacement_validation
 before insert on public.mzs_ops_expense_replacements
 for each row execute function mzs_private.ops_verify_expense_replacement();

comment on table public.mzs_ops_expense_replacements is
 'Staging-only immutable source/replacement lineage; original stays excluded and replacement must have independently approved evidence.';
commit;
