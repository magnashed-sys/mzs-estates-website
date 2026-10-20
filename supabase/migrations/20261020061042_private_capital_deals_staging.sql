-- Staging first. No customer identities, contractual amounts or files in source control.
create table public.mzs_capital_deals (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 2 and 160),
 direction text not null check (direction in ('provided','received')),
 lender text not null check (length(lender) between 2 and 200),
 borrower text not null check (length(borrower) between 2 and 200),
 principal numeric(16,2) not null check (principal > 0),
 annual_rate numeric(7,4) not null check (annual_rate between 0 and 100),
 currency text not null default 'EUR' check (currency='EUR'),
 agreement_date date, start_date date, maturity_date date,
 status text not null default 'draft' check (status in ('draft','in_discussion','agreed','active','completed')),
 review_state text not null default 'needs_review' check (review_state in ('needs_review','reviewed')),
 notes text not null default '' check (length(notes)<=8000),
 source_reference text not null default '' check (length(source_reference)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (maturity_date is null or start_date is null or maturity_date>=start_date)
);
create table public.mzs_capital_instalments (
 id uuid primary key default gen_random_uuid(), deal_id uuid not null references public.mzs_capital_deals(id),
 kind text not null check (kind in ('interest','principal','fee')),
 period_label text not null default '' check (length(period_label)<=120), due_date date not null,
 amount numeric(16,2) not null check (amount>0),
 note text not null default '' check (length(note)<=1000),
 created_at timestamptz not null default now(), unique(id,deal_id)
);
create table public.mzs_capital_payments (
 id uuid primary key default gen_random_uuid(),
 instalment_id uuid not null references public.mzs_capital_instalments(id),
 amount numeric(16,2) not null check (amount>0), paid_on date not null,
 reference text not null check (length(reference) between 2 and 300),
 recorded_by uuid default auth.uid(), created_at timestamptz not null default now(),
 is_void boolean not null default false, void_reason text,
 check ((not is_void and void_reason is null) or (is_void and length(trim(void_reason)) between 3 and 500))
);
create table public.mzs_capital_documents (
 id uuid primary key default gen_random_uuid(),deal_id uuid not null references public.mzs_capital_deals(id),
 title text not null check (length(title) between 2 and 160),
 category text not null check (category in ('agreement','schedule','other')),
 version_label text not null check (length(version_label) between 1 and 40),
 document_status text not null default 'draft' check (document_status in ('draft','signed','reference')),
 file_path text not null unique, file_size integer not null check (file_size between 1 and 20971520),
 created_at timestamptz not null default now(),
 check (file_path ~ ('^' || deal_id::text || '/[0-9a-f-]{36}\.pdf$'))
);
create table public.mzs_capital_deal_audit (
 id bigint generated always as identity primary key,
 table_name text not null, row_id uuid not null, actor_id uuid,
 action text not null, old_record jsonb, new_record jsonb,
 created_at timestamptz not null default now()
);
create index on public.mzs_capital_instalments(deal_id,due_date);
create index on public.mzs_capital_payments(instalment_id);
create index on public.mzs_capital_documents(deal_id);
create index on public.mzs_capital_deal_audit(row_id,created_at);

-- The only authority is the existing active full-admin profile. Department scope
-- or user-editable Auth metadata must never grant access to these financial files.
do $$ declare t text; begin
 foreach t in array array['mzs_capital_deals','mzs_capital_instalments','mzs_capital_payments','mzs_capital_documents','mzs_capital_deal_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy full_admin_read on public.%I for select to authenticated using (exists (select 1 from public.profiles where id=auth.uid() and role=''admin'' and is_active=true))',t);
  if t <> 'mzs_capital_deal_audit' then
   execute format('grant insert on public.%I to authenticated',t);
   execute format('create policy full_admin_insert on public.%I for insert to authenticated with check (exists (select 1 from public.profiles where id=auth.uid() and role=''admin'' and is_active=true))',t);
  end if;
 end loop;
end $$;
grant update(title,direction,lender,borrower,principal,annual_rate,agreement_date,start_date,maturity_date,status,review_state,notes,source_reference) on public.mzs_capital_deals to authenticated;
grant update(is_void,void_reason) on public.mzs_capital_payments to authenticated;
create policy full_admin_update on public.mzs_capital_deals for update to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true))
 with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true));
create policy full_admin_void on public.mzs_capital_payments for update to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true))
 with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true));

-- Immutable payment records, correction by void with a reason. The row lock
-- serialises payments against one instalment, including concurrent admins.
create function public.mzs_capital_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare planned numeric; paid numeric;
begin
 if tg_op='UPDATE' then
  if old.is_void or not new.is_void or (to_jsonb(new)-'is_void'-'void_reason')<>(to_jsonb(old)-'is_void'-'void_reason') then
   raise exception 'Payment records are immutable; void once with a reason' using errcode='22023';
  end if;
  return new;
 end if;
 if new.is_void then raise exception 'Cannot insert a void payment' using errcode='22023'; end if;
 if new.paid_on>current_date then raise exception 'Confirmed payment date cannot be in the future' using errcode='22023'; end if;
 select amount into planned from public.mzs_capital_instalments where id=new.instalment_id for update;
 if planned is null then raise exception 'Instalment unavailable' using errcode='42501'; end if;
 select coalesce(sum(amount),0) into paid from public.mzs_capital_payments where instalment_id=new.instalment_id and not is_void;
 if paid+new.amount>planned then raise exception 'Payment exceeds remaining scheduled amount' using errcode='22023'; end if;
 new.recorded_by:=auth.uid(); new.created_at:=now();
 return new;
end $$;
revoke all on function public.mzs_capital_payment_guard() from public,anon,authenticated;
create trigger capital_payment_guard before insert or update on public.mzs_capital_payments for each row execute function public.mzs_capital_payment_guard();
-- FOR UPDATE in the invoker trigger needs update privilege, but no UPDATE
-- policy exists on instalments: actual schedule mutation remains denied.
grant update(id) on public.mzs_capital_instalments to authenticated;
-- PostgreSQL locking SELECT also applies UPDATE RLS. The trigger below disallows
-- actual UPDATE, while the policy allows row locking for full administrators.
create policy full_admin_lock on public.mzs_capital_instalments for update to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true))
 with check (false);

create function public.mzs_capital_deal_log() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true) then
  raise exception 'Full administrator required' using errcode='42501';
 end if;
 insert into public.mzs_capital_deal_audit(table_name,row_id,actor_id,action,old_record,new_record)
 values(tg_table_name,new.id,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.mzs_capital_deal_log() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['mzs_capital_deals','mzs_capital_instalments','mzs_capital_payments','mzs_capital_documents'] loop
  execute format('create trigger capital_audit after insert or update on public.%I for each row execute function public.mzs_capital_deal_log()',t);
 end loop;
end $$;
create trigger capital_deal_updated before update on public.mzs_capital_deals for each row execute function public.set_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mzs-private-capital-documents','mzs-private-capital-documents',false,20971520,array['application/pdf']);
create policy capital_documents_read on storage.objects for select to authenticated using (
 bucket_id='mzs-private-capital-documents' and exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true));
create policy capital_documents_upload on storage.objects for insert to authenticated with check (
 bucket_id='mzs-private-capital-documents' and exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true)
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
 and exists(select 1 from public.mzs_capital_deals d where d.id::text=split_part(name,'/',1)));
-- Allow cleanup only of orphan uploads. Attached agreements cannot be overwritten/deleted.
create policy capital_documents_cleanup on storage.objects for delete to authenticated using (
 bucket_id='mzs-private-capital-documents' and exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true)
 and not exists(select 1 from public.mzs_capital_documents d where d.file_path=name));
drop policy full_admin_insert on public.mzs_capital_documents;
create policy full_admin_insert on public.mzs_capital_documents for insert to authenticated with check (
 exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true)
 and exists(select 1 from storage.objects o where o.bucket_id='mzs-private-capital-documents' and o.name=file_path));
