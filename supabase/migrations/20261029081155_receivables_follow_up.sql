begin;
set local lock_timeout='2s';
grant usage on schema mzs_private to service_role;
create table public.mzs_invoice_follow_ups(
 id uuid primary key,source text not null check(source in ('service','external','archive','rental','booking')),invoice_id uuid not null,
 revision integer not null check(revision>0),note text not null check(length(btrim(note)) between 3 and 2000),next_on date,
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(source,invoice_id,revision)
);
create index invoice_follow_actor on public.mzs_invoice_follow_ups(actor_id);
create table public.mzs_invoice_reminders(
 id uuid primary key,source text not null,invoice_id uuid not null,snapshot jsonb not null,
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index invoice_reminder_target on public.mzs_invoice_reminders(source,invoice_id,created_at);
create index invoice_reminder_actor on public.mzs_invoice_reminders(actor_id);
create table public.mzs_invoice_reminder_results(
 id uuid primary key references public.mzs_invoice_reminders(id),status text not null check(status in ('accepted','captured','failed','uncertain')),created_at timestamptz not null default now()
);
do $$declare t text;begin foreach t in array array['mzs_invoice_follow_ups','mzs_invoice_reminders','mzs_invoice_reminder_results'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using((select public.is_admin()))',t);
 execute format('create trigger immutable before update or delete on public.%I for each row execute function mzs_private.external_receipt_immutable()',t);
end loop;end $$;
create function mzs_private.save_invoice_follow_up(p_id uuid,p_source text,p_invoice uuid,p_expected integer,p_note text,p_next date) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.mzs_invoice_follow_ups;v integer;t text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_expected is null or p_expected<0 or p_note is null or length(btrim(p_note)) not between 3 and 2000 or p_next<date '2000-01-01' or p_next>date '2099-12-31' then raise exception 'Check the note and follow-up date' using errcode='22023';end if;
 t:=case p_source when 'service' then 'mzs_service_invoices' when 'external' then 'mzs_ops_external_sales_invoices' when 'archive' then 'mzs_invoice_archive_active' when 'rental' then 'mzs_lease_invoices' when 'booking' then 'mzs_booking_invoices' end;
 if t is null then raise exception 'Invalid invoice source' using errcode='22023';end if;
 execute format('select 1 from public.%I where id=$1',t) into v using p_invoice;if v is null then raise exception 'Invoice unavailable' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into old from public.mzs_invoice_follow_ups where id=p_id;
 if found then if old.source=p_source and old.invoice_id=p_invoice and old.revision=p_expected+1 and old.note=btrim(p_note) and old.next_on is not distinct from p_next and old.actor_id=auth.uid() then return p_id;end if;raise exception 'Request identifier already used' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_source||p_invoice::text,2));
 select coalesce(max(revision),0) into v from public.mzs_invoice_follow_ups where source=p_source and invoice_id=p_invoice;
 if v<>p_expected then raise exception 'Follow-up changed. Refresh before saving.' using errcode='22023';end if;
 insert into public.mzs_invoice_follow_ups(id,source,invoice_id,revision,note,next_on,actor_id) values(p_id,p_source,p_invoice,v+1,btrim(p_note),p_next,auth.uid());return p_id;
end $$;
-- Eligibility and recipient come from registered identities, never a free-text address.
-- The same invoice row lock used by receipt registration serializes the final check.
create function mzs_private.invoice_reminder_context(p_source text,p_invoice uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;c public.mzs_lease_relationships;e public.mzs_lease_issuers;paid bigint;n integer;balance bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_source='service' then
 select id,issuer_id,customer_id,number,due_on,gross_cents into r from public.mzs_service_invoices where id=p_invoice for update;
 if not found then return null;end if;
 select coalesce(sum(x.amount_cents),0),count(*) into paid,n from public.mzs_service_invoice_receipts x where x.invoice_id=p_invoice and not exists(select 1 from public.mzs_service_invoice_receipt_reversals z where z.receipt_id=x.id);
 balance:=r.gross_cents-paid;
 elsif p_source='external' then
 select id,issuer_id,customer_id,number,due_on,gross_cents into r from public.mzs_ops_external_sales_invoices where id=p_invoice for update;
 if not found then return null;end if;
 select coalesce(sum(x.amount_cents),0),count(*) into paid,n from public.mzs_external_invoice_receipts x where x.invoice_id=p_invoice and not exists(select 1 from public.mzs_external_invoice_receipt_reversals z where z.receipt_id=x.id);
 if n=0 then return null;end if;balance:=r.gross_cents-paid;
 elsif p_source='archive' then
 select a.id,a.issuer_id,l.relationship_id customer_id,a.number,a.due_on,a.gross_cents,a.source_open_cents into r from public.mzs_invoice_archive a join public.mzs_invoice_archive_customers l on l.invoice_id=a.id where a.id=p_invoice and not exists(select 1 from public.mzs_invoice_archive_exclusions x where x.invoice_id=a.id) for update of a;
 if not found then return null;end if;
 if exists(select 1 from public.mzs_service_invoices x where x.issuer_id=r.issuer_id and upper(btrim(x.number))=upper(btrim(r.number))) or exists(select 1 from public.mzs_ops_external_sales_invoices x where x.issuer_id=r.issuer_id and upper(btrim(x.number))=upper(btrim(r.number))) or exists(select 1 from public.mzs_lease_invoices x where x.issuer_id=r.issuer_id and upper(btrim(x.number))=upper(btrim(r.number))) or exists(select 1 from public.mzs_booking_invoices x where x.issuer_id=r.issuer_id and upper(btrim(x.number))=upper(btrim(r.number))) then return null;end if;
 select coalesce(sum(x.amount_cents),0) into paid from public.mzs_archive_invoice_receipts x where x.invoice_id=p_invoice and not exists(select 1 from public.mzs_archive_invoice_receipt_reversals z where z.receipt_id=x.id);
 balance:=r.source_open_cents-paid;
 else return null;end if;
 if r.gross_cents<=0 or balance<=0 or r.due_on is null or r.due_on>=(now() at time zone 'Europe/Madrid')::date then return null;end if;
 select * into c from public.mzs_lease_relationships where id=r.customer_id for share;
 if not found or c.email is null or btrim(c.email) !~ '^[^@[:space:]<>;,]+@[^@[:space:]<>;,]+\.[^@[:space:]<>;,]+$' then return null;end if;
 select * into strict e from public.mzs_lease_issuers where id=r.issuer_id for share;
 return jsonb_build_object('source',p_source,'invoice_id',p_invoice,'issuer_id',e.id,'customer_id',c.id,'number',r.number,'customer',c.name,'issuer',e.name,'email',lower(btrim(c.email)),'due_on',r.due_on,'balance_cents',balance);
end $$;
create function mzs_private.claim_invoice_reminder(p_id uuid,p_source text,p_invoice uuid,p_expected jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_snapshot jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null then raise exception 'Request identifier required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,3));
 if exists(select 1 from public.mzs_invoice_reminders where id=p_id) then raise exception 'Reminder already requested. Check delivery history.' using errcode='22023';end if;
 current_snapshot:=mzs_private.invoice_reminder_context(p_source,p_invoice);
 if current_snapshot is null or current_snapshot is distinct from p_expected then raise exception 'Balance or recipient changed, or reminder is not eligible. Refresh the preview.' using errcode='22023';end if;
 if exists(select 1 from public.mzs_invoice_reminders m left join public.mzs_invoice_reminder_results z on z.id=m.id where m.source=p_source and m.invoice_id=p_invoice and (z.id is null or z.status='uncertain' or m.created_at>now()-interval '24 hours')) then raise exception 'A recent or uncertain reminder exists. Check delivery history before further contact.' using errcode='22023';end if;
 insert into public.mzs_invoice_reminders(id,source,invoice_id,snapshot,actor_id) values(p_id,p_source,p_invoice,current_snapshot,auth.uid());return current_snapshot;
end $$;
create function mzs_private.finish_invoice_reminder(p_id uuid,p_status text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_status is null or p_status not in ('accepted','captured','failed','uncertain') then raise exception 'Invalid outcome';end if;
 insert into public.mzs_invoice_reminder_results(id,status) values(p_id,p_status) on conflict(id) do nothing;return found;
end $$;
create function public.mzs_save_invoice_follow_up(p_id uuid,p_source text,p_invoice uuid,p_expected integer,p_note text,p_next date) returns uuid language sql security invoker set search_path='' as $$select mzs_private.save_invoice_follow_up(p_id,p_source,p_invoice,p_expected,p_note,p_next)$$;
create function public.mzs_invoice_reminder_context(p_source text,p_invoice uuid) returns jsonb language sql security invoker set search_path='' as $$select mzs_private.invoice_reminder_context(p_source,p_invoice)$$;
create function public.mzs_claim_invoice_reminder(p_id uuid,p_source text,p_invoice uuid,p_expected jsonb) returns jsonb language sql security invoker set search_path='' as $$select mzs_private.claim_invoice_reminder(p_id,p_source,p_invoice,p_expected)$$;
create function public.mzs_finish_invoice_reminder(p_id uuid,p_status text) returns boolean language sql security invoker set search_path='' as $$select mzs_private.finish_invoice_reminder(p_id,p_status)$$;
do $$declare f record;begin for f in select p.oid::regprocedure id,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mzs_private') and p.proname in ('save_invoice_follow_up','mzs_save_invoice_follow_up','invoice_reminder_context','mzs_invoice_reminder_context','claim_invoice_reminder','mzs_claim_invoice_reminder','finish_invoice_reminder','mzs_finish_invoice_reminder') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.id);
 execute format('grant execute on function %s to %I',f.id,case when f.proname in ('finish_invoice_reminder','mzs_finish_invoice_reminder') then 'service_role' else 'authenticated' end);
end loop;end $$;
commit;
