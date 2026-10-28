-- STAGING ONLY: protected maintenance evidence photographs; no public storage.
-- Staff photos use original ticket ownership and CURRENT assigned property access.
begin;
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

comment on table public.mzs_ops_maintenance_photos is
 'Immutable private original JPEG, PNG or WebP evidence. Staff sees only own tickets while assigned; no public URL or owner data.';
commit;
