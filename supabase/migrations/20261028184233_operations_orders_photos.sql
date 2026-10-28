-- Internal work orders and private maintenance photos. No seeds or external dispatch.
begin;
do $install$ begin
if to_regclass('public.mzs_ops_maintenance_work_orders') is null then execute $orders$
create table public.mzs_ops_maintenance_work_orders (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.mzs_ops_maintenance_tickets(id) on delete restrict,
 legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 supplier_relationship_id uuid not null references public.mzs_lease_relationships(id) on delete restrict,
 scope_of_work text not null check(length(btrim(scope_of_work)) between 10 and 2000 and scope_of_work !~ '[[:cntrl:]]'),
 quotation_reference text not null check(length(btrim(quotation_reference)) between 3 and 180 and quotation_reference !~ '[[:cntrl:]]'),
 approved_budget_net_cents bigint not null check(approved_budget_net_cents between 0 and 100000000000),
 approved_budget_vat_cents bigint not null check(approved_budget_vat_cents between 0 and 100000000000),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(approved_budget_net_cents+approved_budget_vat_cents>0),
 unique(ticket_id,quotation_reference)
);
alter table public.mzs_ops_maintenance_work_orders enable row level security;
revoke all on public.mzs_ops_maintenance_work_orders from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_work_orders to authenticated;
grant insert(ticket_id,legal_entity_id,supplier_relationship_id,scope_of_work,quotation_reference,approved_budget_net_cents,approved_budget_vat_cents)
 on public.mzs_ops_maintenance_work_orders to authenticated;
create policy ops_work_order_read on public.mzs_ops_maintenance_work_orders
 for select to authenticated using ((select public.is_admin()));
create policy ops_work_order_insert on public.mzs_ops_maintenance_work_orders
 for insert to authenticated with check ((select public.is_admin()) and created_by=(select auth.uid()));
create function mzs_private.ops_validate_maintenance_work_order()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets; stage text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.created_by is distinct from (select auth.uid()) then
  raise exception 'Admin-only internal work order' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Maintenance ticket missing';end if;
 select action into stage from public.mzs_ops_maintenance_events where ticket_id=ticket.id
  order by sequence_no desc limit 1;
 if stage not in ('triaged','scheduled','in_progress') or stage is null
 then raise exception 'Ticket must be triaged before work-order draft';end if;
 if not exists(select 1 from public.mzs_ops_property_entity_links l
  where l.property_id=ticket.property_id and l.legal_entity_id=new.legal_entity_id
  and l.relationship_type='payer' and l.effective_from<=current_date
  and (l.effective_until is null or l.effective_until>=current_date))
 then raise exception 'Verified property paying entity required';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_maintenance_work_order() from public,anon,authenticated,service_role;
create trigger ops_work_order_guard before insert on public.mzs_ops_maintenance_work_orders
 for each row execute function mzs_private.ops_validate_maintenance_work_order();

create table public.mzs_ops_maintenance_work_order_decisions (
 id uuid primary key default gen_random_uuid(),
 work_order_id uuid not null unique references public.mzs_ops_maintenance_work_orders(id) on delete restrict,
 decision text not null check (decision in ('authorized_internally','declined')),
 reason text not null check(length(btrim(reason)) between 8 and 1000 and reason !~ '[[:cntrl:]]'),
 decided_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 decided_at timestamptz not null default now()
);
alter table public.mzs_ops_maintenance_work_order_decisions enable row level security;
revoke all on public.mzs_ops_maintenance_work_order_decisions from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_work_order_decisions to authenticated;
grant insert(work_order_id,decision,reason) on public.mzs_ops_maintenance_work_order_decisions to authenticated;
create policy ops_order_decision_read on public.mzs_ops_maintenance_work_order_decisions
 for select to authenticated using ((select public.is_admin()));
create policy ops_order_decision_insert on public.mzs_ops_maintenance_work_order_decisions
 for insert to authenticated with check ((select public.is_admin()) and decided_by=(select auth.uid()));
create function mzs_private.ops_validate_order_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare work_order public.mzs_ops_maintenance_work_orders;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.decided_by is distinct from (select auth.uid()) then
 raise exception 'Admin authorization required' using errcode='42501';end if;
 select * into work_order from public.mzs_ops_maintenance_work_orders where id=new.work_order_id for update;
 if not found then raise exception 'Work order missing';end if;
 if exists(select 1 from public.mzs_ops_maintenance_work_order_decisions where work_order_id=work_order.id)
 then raise exception 'Work order already decided';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_order_decision() from public,anon,authenticated,service_role;
create trigger ops_order_decision_guard before insert on public.mzs_ops_maintenance_work_order_decisions
 for each row execute function mzs_private.ops_validate_order_decision();


$orders$;end if;
if to_regclass('public.mzs_ops_maintenance_photos') is null then execute $photos$
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mzs-ops-ticket-photos','mzs-ops-ticket-photos',false,4194304,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create table public.mzs_ops_maintenance_photos (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.mzs_ops_maintenance_tickets(id) on delete restrict,
 storage_path text not null unique check(
   storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 ),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 byte_size integer not null check(byte_size between 1 and 4194304),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_maintenance_photos_ticket on public.mzs_ops_maintenance_photos(ticket_id,created_at);
alter table public.mzs_ops_maintenance_photos enable row level security;
revoke all on public.mzs_ops_maintenance_photos from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_photos to authenticated;
grant insert(ticket_id,storage_path,mime_type,sha256,byte_size)
 on public.mzs_ops_maintenance_photos to authenticated;
create policy ops_ticket_photos_read on public.mzs_ops_maintenance_photos
 for select to authenticated using(
  (select public.is_admin()) or exists(
   select 1 from public.mzs_ops_maintenance_tickets t where t.id=ticket_id
    and t.reported_by=(select auth.uid()) and
    (select mzs_private.ops_can_work_on_property(t.property_id))
  )
 );
create policy ops_ticket_photos_insert on public.mzs_ops_maintenance_photos
 for insert to authenticated with check(
 created_by=(select auth.uid()) and (
  (select public.is_admin()) or exists(
   select 1 from public.mzs_ops_maintenance_tickets t
   where t.id=ticket_id and t.reported_by=(select auth.uid())
   and (select mzs_private.ops_can_work_on_property(t.property_id))
  ))
 );

create function mzs_private.ops_verify_ticket_photo()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets;
begin
 if (select auth.uid()) is null or new.created_by is distinct from (select auth.uid()) then
  raise exception 'Authenticated photo author required' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Ticket missing';end if;
 if not ((select public.is_admin()) or (ticket.reported_by=(select auth.uid())
  and mzs_private.ops_can_work_on_property(ticket.property_id)))
 then raise exception 'Ticket photo belongs to a different or unassigned reporter' using errcode='42501';end if;
 if split_part(new.storage_path,'/',1)<>ticket.id::text
 then raise exception 'Photo path must match maintenance ticket';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='mzs-ops-ticket-photos'
   and o.name=new.storage_path) then raise exception 'Original ticket photo is not uploaded';end if;
 if (select count(*) from public.mzs_ops_maintenance_photos p where p.ticket_id=ticket.id)>=3
 then raise exception 'Maximum of three immutable photos per maintenance ticket';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_verify_ticket_photo()
 from public,anon,authenticated,service_role;
create trigger ops_ticket_photo_guard before insert on public.mzs_ops_maintenance_photos
 for each row execute function mzs_private.ops_verify_ticket_photo();

create policy ops_ticket_photo_storage_insert on storage.objects
 for insert to authenticated with check(
 bucket_id='mzs-ops-ticket-photos'
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and ((select public.is_admin()) or exists(
  select 1 from public.mzs_ops_maintenance_tickets t
   where t.id::text=split_part(name,'/',1)
    and t.reported_by=(select auth.uid())
    and (select mzs_private.ops_can_work_on_property(t.property_id))))
 and exists(select 1 from public.mzs_ops_maintenance_tickets t
   where t.id::text=split_part(name,'/',1))
 );
create policy ops_ticket_photo_storage_read on storage.objects
 for select to authenticated using(
 bucket_id='mzs-ops-ticket-photos' and
 ((select public.is_admin()) or exists(
  select 1 from public.mzs_ops_maintenance_tickets t
   where t.id::text=split_part(name,'/',1)
    and t.reported_by=(select auth.uid())
    and (select mzs_private.ops_can_work_on_property(t.property_id))))
 );
create policy ops_ticket_photo_cleanup on storage.objects
 for delete to authenticated using(
 bucket_id='mzs-ops-ticket-photos'
 and not exists(select 1 from public.mzs_ops_maintenance_photos p where p.storage_path=name)
 and ((select public.is_admin()) or exists(
  select 1 from public.mzs_ops_maintenance_tickets t
   where t.id::text=split_part(name,'/',1) and t.reported_by=(select auth.uid())
   and (select mzs_private.ops_can_work_on_property(t.property_id))))
 );


$photos$;end if;
end $install$;
-- Normalize the path constraint on both fresh and pre-existing staging tables.
alter table public.mzs_ops_maintenance_photos drop constraint mzs_ops_maintenance_photos_storage_path_check;
alter table public.mzs_ops_maintenance_photos add constraint mzs_ops_maintenance_photos_storage_path_check
 check(storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
-- Decisions can cancel an internal authorization; the preceding decision is retained.
alter table public.mzs_ops_maintenance_work_order_decisions drop constraint mzs_ops_maintenance_work_order_decisions_work_order_id_key;
alter table public.mzs_ops_maintenance_work_order_decisions drop constraint mzs_ops_maintenance_work_order_decisions_decision_check;
alter table public.mzs_ops_maintenance_work_order_decisions add constraint ops_work_order_decision_values check(decision in ('authorized_internally','declined','cancelled'));
alter table public.mzs_ops_maintenance_work_order_decisions add column sequence_no bigint generated always as identity unique;
alter table public.mzs_ops_maintenance_work_order_decisions add column expected_decision_id uuid;
grant insert(expected_decision_id) on public.mzs_ops_maintenance_work_order_decisions to authenticated;
create index ops_work_order_latest_decision on public.mzs_ops_maintenance_work_order_decisions(work_order_id,sequence_no desc);
create or replace function mzs_private.ops_validate_order_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare work_order public.mzs_ops_maintenance_work_orders; previous public.mzs_ops_maintenance_work_order_decisions; p uuid; stage text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.decided_by is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 select * into work_order from public.mzs_ops_maintenance_work_orders where id=new.work_order_id for update;
 if not found then raise exception 'Work order missing';end if;
 select * into previous from public.mzs_ops_maintenance_work_order_decisions where work_order_id=new.work_order_id order by sequence_no desc limit 1;
 if new.expected_decision_id is distinct from previous.id then raise exception 'Stale work order decision';end if;
 if ((previous.id is null and new.decision in ('authorized_internally','declined')) or (previous.decision='authorized_internally' and new.decision='cancelled')) is distinct from true then raise exception 'Work order already decided';end if;
 if new.decision='authorized_internally' then
  select property_id into p from public.mzs_ops_maintenance_tickets where id=work_order.ticket_id for update;
  select action into stage from public.mzs_ops_maintenance_events where ticket_id=work_order.ticket_id order by sequence_no desc limit 1;
  if stage not in ('triaged','scheduled','in_progress','reopened') or stage is null then raise exception 'Ticket must be open and triaged';end if;
  if not exists(select 1 from public.mzs_ops_property_entity_links l where l.property_id=p and l.legal_entity_id=work_order.legal_entity_id and l.relationship_type='payer' and l.effective_from<=current_date and (l.effective_until is null or l.effective_until>=current_date)) then raise exception 'Current verified payer required';end if;
 end if;
 return new;
end $fn$;
create view public.mzs_ops_current_work_orders with(security_invoker=true,security_barrier=true) as
select w.*,coalesce(d.decision,'draft') as decision,d.id as latest_decision_id,d.reason as decision_reason,d.decided_at
from public.mzs_ops_maintenance_work_orders w
left join lateral(select * from public.mzs_ops_maintenance_work_order_decisions x where x.work_order_id=w.id order by x.sequence_no desc limit 1) d on true;
revoke all on public.mzs_ops_current_work_orders from public,anon,authenticated,service_role;
grant select on public.mzs_ops_current_work_orders to authenticated;

-- Preserve originals; conceal a mistaken/sensitive photograph through an audited event.
create table public.mzs_ops_maintenance_photo_holds(
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null unique references public.mzs_ops_maintenance_photos(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 8 and 500 and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.mzs_ops_maintenance_photo_holds enable row level security;
revoke all on public.mzs_ops_maintenance_photo_holds from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_photo_holds to authenticated;
grant insert(photo_id,reason) on public.mzs_ops_maintenance_photo_holds to authenticated;
create policy ops_photo_holds_read on public.mzs_ops_maintenance_photo_holds for select to authenticated using((select public.is_admin()));
create policy ops_photo_holds_insert on public.mzs_ops_maintenance_photo_holds for insert to authenticated with check((select public.is_admin()) and recorded_by=(select auth.uid()));
create function mzs_private.ops_photo_is_held(photo uuid) returns boolean language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null and exists(select 1 from public.mzs_ops_maintenance_photo_holds h where h.photo_id=photo)
$fn$;
revoke all on function mzs_private.ops_photo_is_held(uuid) from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_photo_is_held(uuid) to authenticated;
drop policy ops_ticket_photos_read on public.mzs_ops_maintenance_photos;
create policy ops_ticket_photos_read on public.mzs_ops_maintenance_photos for select to authenticated using(
 (select public.is_admin()) or (not mzs_private.ops_photo_is_held(id) and exists(select 1 from public.mzs_ops_maintenance_tickets t where t.id=ticket_id and t.reported_by=(select auth.uid()) and mzs_private.ops_can_work_on_property(t.property_id)))
);
-- All reads require registered evidence and current scope. Held bytes are unavailable even to Admin.
create function mzs_private.ops_photo_is_registered(path text) returns boolean language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null and exists(select 1 from public.mzs_ops_maintenance_photos p where p.storage_path=path)
$fn$;
revoke all on function mzs_private.ops_photo_is_registered(text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_photo_is_registered(text) to authenticated;
drop policy ops_ticket_photo_storage_read on storage.objects;
create policy ops_ticket_photo_storage_read on storage.objects for select to authenticated using(
 bucket_id='mzs-ops-ticket-photos' and (exists(select 1 from public.mzs_ops_maintenance_photos p where p.storage_path=name and not mzs_private.ops_photo_is_held(p.id)) or (owner_id=(select auth.uid())::text and not mzs_private.ops_photo_is_registered(name)))
);
-- A cleanup query must see ALL metadata, not only rows visible through current staff RLS.
drop policy ops_ticket_photo_cleanup on storage.objects;
create policy ops_ticket_photo_cleanup on storage.objects for delete to authenticated using(
 bucket_id='mzs-ops-ticket-photos' and not mzs_private.ops_photo_is_registered(name) and owner_id=(select auth.uid())::text
);
-- Verify metadata against the uploader's object, serialize the three-photo cap.
create or replace function mzs_private.ops_verify_ticket_photo()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets; object_meta jsonb;
begin
 if auth.uid() is null or new.created_by is distinct from auth.uid() then raise exception 'Authenticated photo author required' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Ticket missing';end if;
 if not (public.is_admin() or (ticket.reported_by=auth.uid() and mzs_private.ops_can_work_on_property(ticket.property_id))) then raise exception 'Ticket photo access denied' using errcode='42501';end if;
 if split_part(new.storage_path,'/',1)<>ticket.id::text then raise exception 'Photo path must match ticket';end if;
 select metadata into object_meta from storage.objects where bucket_id='mzs-ops-ticket-photos' and name=new.storage_path and owner_id=auth.uid()::text;
 if not found then raise exception 'Uploaded photo owned by author required';end if;
 if (object_meta->>'size')::bigint is distinct from new.byte_size::bigint or object_meta->>'mimetype' is distinct from new.mime_type then raise exception 'Photo metadata mismatch';end if;
 if (select count(*) from public.mzs_ops_maintenance_photos where ticket_id=ticket.id)>=3 then raise exception 'Maximum three registered photos';end if;
 return new;
end $fn$;
create index if not exists ops_orders_ticket_idx on public.mzs_ops_maintenance_work_orders(ticket_id);
create index if not exists ops_orders_entity_idx on public.mzs_ops_maintenance_work_orders(legal_entity_id);
create index if not exists ops_orders_supplier_idx on public.mzs_ops_maintenance_work_orders(supplier_relationship_id);
create index if not exists ops_orders_actor_idx on public.mzs_ops_maintenance_work_orders(created_by);
create index if not exists ops_order_decider_idx on public.mzs_ops_maintenance_work_order_decisions(decided_by);
create index if not exists ops_photo_creator_idx on public.mzs_ops_maintenance_photos(created_by);
create index if not exists ops_photo_hold_actor_idx on public.mzs_ops_maintenance_photo_holds(recorded_by);
comment on table public.mzs_ops_maintenance_photos is 'Private maintenance photographs. Application uploads and downloads re-encode images without EXIF/GPS. Registered files are immutable; holds prevent further downloads. No automatic retention/deletion period is asserted.';
-- One statement snapshot for invoice and receipt exports; invoker retains all source RLS.
create function public.mzs_ops_accountant_source(p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
 if (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 select jsonb_build_object(
 'issuer',(select jsonb_build_object('id',id,'name',name) from public.mzs_lease_issuers where id=p_entity),
 'leases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,contract_id,number,issued_on,total from public.mzs_lease_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,booking_id,number,issued_on,total,net_total,vat_total from public.mzs_booking_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'rent_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.invoice_id,p.amount,p.received_on,p.reference,p.reversed_at from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'guest_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.booking_id,p.amount,p.received_on,p.reference,p.receipt_type,p.reversed_at from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'snapshot_at',statement_timestamp()) into result;
 return result;
end $fn$;
revoke all on function public.mzs_ops_accountant_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_accountant_source(uuid) to authenticated;
-- Bound uploaded objects too, including interrupted registrations.
create function mzs_private.ops_photo_slot_available(path text)
returns boolean language plpgsql volatile security definer set search_path='' as $fn$
declare t public.mzs_ops_maintenance_tickets;
begin
 if auth.uid() is null then return false;end if;
 select * into t from public.mzs_ops_maintenance_tickets where id::text=split_part(path,'/',1) for update;
 if not found or not (public.is_admin() or (t.reported_by=auth.uid() and mzs_private.ops_can_work_on_property(t.property_id))) then return false;end if;
 return (select count(*) from storage.objects where bucket_id='mzs-ops-ticket-photos' and split_part(name,'/',1)=t.id::text)<3
 and (select count(*) from public.mzs_ops_maintenance_photos where ticket_id=t.id)<3;
end $fn$;
revoke all on function mzs_private.ops_photo_slot_available(text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_photo_slot_available(text) to authenticated;
drop policy ops_ticket_photo_storage_insert on storage.objects;
create policy ops_ticket_photo_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='mzs-ops-ticket-photos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and mzs_private.ops_photo_slot_available(name)
);
commit;
