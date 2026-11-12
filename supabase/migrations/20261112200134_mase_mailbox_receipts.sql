-- Durable source receipts. No mailbox or invoice data seeded.
begin;
create table public.mzs_mailbox_receipts(
 id uuid primary key default gen_random_uuid(),
 mailbox text not null check(mailbox='mase@mzsgroup.eu'),
 folder text not null check(folder='INBOX'),
 uid_validity bigint not null check(uid_validity between 1 and 4294967295),
 uid bigint not null check(uid between 1 and 4294967295),
 issuer_id uuid not null references public.mzs_lease_issuers(id),
 year_id uuid not null references public.mzs_accountancy_years(id),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 attachments jsonb not null check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments) between 1 and 5 and octet_length(attachments::text)<10000),
 state text not null default 'review' check(state in('review','moving','moved','uncertain')),
 move_token uuid,
 destination_uid_validity bigint check(destination_uid_validity between 1 and 4294967295),
 destination_uid bigint check(destination_uid between 1 and 4294967295),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(mailbox,folder,uid_validity,uid),
 check((state='review' and move_token is null) or (state<>'review' and move_token is not null)),
 check(state<>'moved' or (destination_uid_validity is not null and destination_uid is not null))
);
create index mailbox_receipt_issuer on public.mzs_mailbox_receipts(issuer_id,state);
create index mailbox_receipt_year on public.mzs_mailbox_receipts(year_id);
create index mailbox_receipt_actor on public.mzs_mailbox_receipts(created_by);
alter table public.mzs_mailbox_receipts enable row level security;
revoke all on public.mzs_mailbox_receipts from public,anon,authenticated,service_role;
grant select on public.mzs_mailbox_receipts to authenticated;
grant select,insert,update on public.mzs_mailbox_receipts to service_role;
create policy mailbox_receipt_admin on public.mzs_mailbox_receipts for select to authenticated using((select public.is_admin()));

create function mzs_private.validate_mailbox_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
declare a jsonb;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['state','move_token','destination_uid_validity','destination_uid','updated_at'])
    is distinct from (to_jsonb(old)-array['state','move_token','destination_uid_validity','destination_uid','updated_at']) then
   raise exception 'Mailbox source receipt is immutable';
  end if;
  if not ((old.state='review' and new.state='moving') or
          (old.state='moving' and new.state in('review','moved','uncertain'))) then
   raise exception 'Invalid mailbox transition';
  end if;
  if old.state='moving' and new.state<>'review' and new.move_token is distinct from old.move_token then raise exception 'Move ownership changed';end if;
  if new.state in('moving','moved') then
   for a in select value from jsonb_array_elements(new.attachments) loop
    if not exists(select 1 from public.mzs_purchase_pdf_decisions d
      where d.intake_id=(a->>'id')::uuid and d.action='accepted' and d.draft_id is not null) then
     raise exception 'Every attachment must be explicitly accepted';
    end if;
   end loop;
  end if;
 else
  if new.state<>'review' or not exists(select 1 from public.profiles where id=new.created_by and role='admin' and is_active) then
   raise exception 'Invalid receipt actor or initial state';
  end if;
 end if;
 for a in select value from jsonb_array_elements(new.attachments) loop
  if not exists(select 1 from public.mzs_purchase_pdf_intakes i join public.mzs_purchase_pdf_results r on r.intake_id=i.id
    where i.id=(a->>'id')::uuid and i.sha256=a->>'sha256' and r.sha256=i.sha256 and r.verdict='clean'
    and i.issuer_id=new.issuer_id and i.year_id=new.year_id) then raise exception 'Invalid retained attachment';end if;
 end loop;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function mzs_private.validate_mailbox_receipt() from public,anon,authenticated;
grant execute on function mzs_private.validate_mailbox_receipt() to service_role;
create trigger mailbox_receipt_validate before insert or update on public.mzs_mailbox_receipts for each row execute function mzs_private.validate_mailbox_receipt();
commit;
