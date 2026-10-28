begin;
-- Administrative association only. Original invoice headers and client access remain unchanged.
create table public.mzs_invoice_archive_customers(
 invoice_id uuid primary key references public.mzs_invoice_archive(id),
 relationship_id uuid not null references public.mzs_lease_relationships(id),
 source_name text not null,
 relationship_name text not null,
 basis text not null check(basis='unique_exact_name'),
 authorization_reference text not null check(length(authorization_reference) between 10 and 1000),
 linked_at timestamptz not null default now()
);
create index invoice_archive_customers_relationship on public.mzs_invoice_archive_customers(relationship_id);
alter table public.mzs_invoice_archive_customers enable row level security;
revoke all on public.mzs_invoice_archive_customers from public,anon,authenticated,service_role;
grant select on public.mzs_invoice_archive_customers to authenticated;
create policy archive_customer_admin on public.mzs_invoice_archive_customers for select to authenticated using((select public.is_admin()));
create function mzs_private.archive_customer_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.mzs_invoice_archive;target public.mzs_lease_relationships;matches bigint;
begin
 select * into strict source from public.mzs_invoice_archive where id=new.invoice_id;
 select * into strict target from public.mzs_lease_relationships where id=new.relationship_id;
 if source.issued_on<date '2026-01-01' or source.issued_on>=date '2027-01-01' then raise exception 'Customer linking is scoped to 2026';end if;
 if lower(btrim(source.customer_name))<>lower(btrim(target.name)) then raise exception 'Customer names do not match';end if;
 select count(*) into matches from public.mzs_lease_relationships where lower(btrim(name))=lower(btrim(source.customer_name));
 if matches<>1 then raise exception 'Customer name is ambiguous';end if;
 new.source_name:=source.customer_name;new.relationship_name:=target.name;
 return new;
end $$;
revoke all on function mzs_private.archive_customer_guard() from public,anon,authenticated,service_role;
create trigger archive_customer_guard before insert on public.mzs_invoice_archive_customers for each row execute function mzs_private.archive_customer_guard();
create trigger archive_customer_immutable before update or delete on public.mzs_invoice_archive_customers for each row execute function mzs_private.ops_history_immutable();
comment on table public.mzs_invoice_archive_customers is 'Controlled 2026 invoice-to-customer associations, preserved separately from immutable source invoices. Admin read only; no client portal access grant.';
commit;
