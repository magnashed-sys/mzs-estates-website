create table if not exists public.mzs_booking_invoice_drafts (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.rental_bookings(id) on delete restrict,
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 invoice_kind text not null default 'final' check(invoice_kind in ('final')),
 recipient_name text not null check(length(btrim(recipient_name)) between 1 and 250),
 recipient_email text,
 gross_total numeric(14,2) not null check(gross_total>=0),
 vat_rate numeric(6,4) not null check(vat_rate>=0 and vat_rate<=1),
 net_total numeric(14,2) not null,
 vat_total numeric(14,2) not null,
 tax_note text not null check(length(btrim(tax_note)) between 5 and 1000),
 snapshot jsonb not null,
 review_status text not null default 'draft' check(review_status='draft'),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 constraint booking_invoice_draft_total check (net_total+vat_total=gross_total)
);
create unique index if not exists mzs_booking_invoice_one_draft on public.mzs_booking_invoice_drafts(booking_id);
alter table public.mzs_booking_invoice_drafts enable row level security;
revoke all on public.mzs_booking_invoice_drafts from anon,authenticated;
grant select,insert on public.mzs_booking_invoice_drafts to authenticated;
create policy booking_invoice_admin_read on public.mzs_booking_invoice_drafts for select to authenticated using((select public.is_admin()));
create policy booking_invoice_admin_insert on public.mzs_booking_invoice_drafts for insert to authenticated with check((select public.is_admin()) and created_by=(select auth.uid()));
-- Intentionally no UPDATE, DELETE, issuing, PDF generation or delivery on this first Staging iteration.
