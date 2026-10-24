-- Additive integration: existing records and immutable billing snapshots are retained.
alter table public.mzs_lease_relationships
 add column roles text[] not null default array['tenant']::text[] check(roles <@ array['tenant','owner','investor','partner']::text[] and cardinality(roles)>0),
 add column profile_id uuid references public.profiles(id);
create index lease_relationship_profile on public.mzs_lease_relationships(profile_id);
create table public.mzs_lease_issuers (
 id uuid primary key default gen_random_uuid(), relationship_id uuid references public.mzs_lease_relationships(id),
 name text not null check(length(trim(name)) between 2 and 200),address text not null check(length(trim(address)) between 2 and 1000),
 iban text not null check(length(trim(iban)) between 5 and 40),tax_id text not null default '' check(length(tax_id)<=60),
 registration_number text not null default '' check(length(registration_number)<=100),
 prefix text not null unique check(prefix ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),next_number bigint not null default 1 check(next_number>0),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index lease_issuer_relationship on public.mzs_lease_issuers(relationship_id);
alter table public.mzs_lease_contracts add column issuer_id uuid references public.mzs_lease_issuers(id);
create index lease_contract_issuer on public.mzs_lease_contracts(issuer_id);
create table public.mzs_lease_invoices (
 id uuid primary key default gen_random_uuid(),draft_id uuid not null unique references public.mzs_lease_invoice_drafts(id),
 contract_id uuid not null references public.mzs_lease_contracts(id),issuer_id uuid not null references public.mzs_lease_issuers(id),
 number text not null unique,issued_on date not null,issued_by uuid not null references public.profiles(id),
 due_date date not null,total numeric(14,2) not null,payload jsonb not null,
 delivery_status text not null default 'unsent' check(delivery_status in ('unsent','sending','accepted','captured','failed','uncertain')),
 delivery_token uuid,delivery_started_at timestamptz,delivery_finished_at timestamptz,delivery_error text,
 created_at timestamptz not null default now()
);
create index lease_invoice_contract on public.mzs_lease_invoices(contract_id);
create index lease_invoice_issuer on public.mzs_lease_invoices(issuer_id);
create index lease_invoice_actor on public.mzs_lease_invoices(issued_by);
create table public.mzs_lease_payments (
 id uuid primary key,invoice_id uuid not null references public.mzs_lease_invoices(id),
 amount numeric(14,2) not null check(amount>0),received_on date not null,reference text not null check(length(trim(reference)) between 1 and 500),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 reversed_at timestamptz,reversed_by uuid references public.profiles(id),reversal_reason text check(length(reversal_reason)<=500)
);
create index lease_payment_invoice on public.mzs_lease_payments(invoice_id);
create index lease_payment_actor on public.mzs_lease_payments(recorded_by);
create index lease_payment_reverser on public.mzs_lease_payments(reversed_by);
do $$ declare t text; begin
 foreach t in array array['mzs_lease_issuers','mzs_lease_invoices','mzs_lease_payments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy lease_admin_read on public.%I for select to authenticated using ((select public.is_admin()))',t);
 end loop;
end $$;
grant insert(name,address,iban,tax_id,registration_number,prefix,relationship_id),update(name,address,iban,tax_id,registration_number,relationship_id) on public.mzs_lease_issuers to authenticated;
create policy issuer_admin_insert on public.mzs_lease_issuers for insert to authenticated with check((select public.is_admin()));
create policy issuer_admin_update on public.mzs_lease_issuers for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create trigger issuer_version before insert or update on public.mzs_lease_issuers for each row execute function mzs_private.version_lease_relationship();
-- The issuer is explicitly selected. Never infer ownership from a similar name.
create function mzs_private.link_lease_issuer() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.mzs_lease_issuers;
begin
 if new.status='draft' and new.issuer_id is not null then
 select * into strict e from public.mzs_lease_issuers where id=new.issuer_id;
 new.issuer_name:=e.name;new.issuer_address:=e.address;new.issuer_iban:=e.iban;new.issuer_tax_id:=e.tax_id;
 end if;return new;
end $$;
revoke all on function mzs_private.link_lease_issuer() from public,anon,authenticated,service_role;
create trigger a_link_lease_issuer before insert or update on public.mzs_lease_contracts for each row execute function mzs_private.link_lease_issuer();
create function mzs_private.issue_lease_invoice(p_draft uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.mzs_lease_invoice_drafts;e public.mzs_lease_issuers;c public.mzs_lease_contracts;existing uuid;result uuid;invoice_number text;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501';end if;
 select * into strict d from public.mzs_lease_invoice_drafts where id=p_draft for update;
 select id into existing from public.mzs_lease_invoices where draft_id=p_draft;
 if existing is not null then return existing;end if;
 if d.review_status<>'checked' then raise exception 'Review and check this draft before issuing';end if;
 select * into strict c from public.mzs_lease_contracts where id=d.contract_id;
 if c.issuer_id is null then raise exception 'Select a registered issuing entity on the contract before activation';end if;
 select * into strict e from public.mzs_lease_issuers where id=c.issuer_id for update;
 if length(trim(d.snapshot->>'tenant_address'))<2 or length(trim(d.snapshot->>'issuer_address'))<2 or d.total<=0 then raise exception 'Complete billing details and a positive total are required';end if;
 invoice_number:=e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)), '0');
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;
 insert into public.mzs_lease_invoices(draft_id,contract_id,issuer_id,number,issued_on,issued_by,due_date,total,payload)
 values(d.id,c.id,e.id,invoice_number,(now() at time zone 'Europe/Amsterdam')::date,auth.uid(),d.due_date,d.total,to_jsonb(d)||jsonb_build_object('issuer_registration',e.registration_number)) returning id into result;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c.id,auth.uid(),'invoice:issued',jsonb_build_object('invoice_id',result,'number',invoice_number));
 return result;
end $$;
create function public.mzs_issue_lease_invoice(p_draft uuid) returns uuid language sql security invoker set search_path='' as $$select mzs_private.issue_lease_invoice(p_draft)$$;
-- Issued drafts cannot be relabelled as unchecked.
create or replace function mzs_private.review_lease_invoice() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.mzs_lease_invoices where draft_id=old.id) then raise exception 'Issued invoices retain their approved review';end if;
 new.reviewed_by:=auth.uid();new.reviewed_at:=now();return new;
end $$;
create function mzs_private.record_lease_payment(p_invoice uuid,p_id uuid,p_amount numeric,p_date date,p_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.mzs_lease_invoices;paid numeric;old public.mzs_lease_payments;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501';end if;
 select * into strict i from public.mzs_lease_invoices where id=p_invoice for update;
 select * into old from public.mzs_lease_payments where id=p_id;
 if found then
 if old.invoice_id=p_invoice and old.amount=p_amount and old.received_on=p_date and old.reference=p_reference then return old.id;end if;
 raise exception 'Payment request already used';end if;
 select coalesce(sum(amount),0) into paid from public.mzs_lease_payments where invoice_id=i.id and reversed_at is null;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>i.total-paid or p_date is null or p_date>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Enter a received payment within the outstanding balance';end if;
 insert into public.mzs_lease_payments(id,invoice_id,amount,received_on,reference,recorded_by) values(p_id,i.id,p_amount,p_date,p_reference,auth.uid());
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(i.contract_id,auth.uid(),'payment:recorded',jsonb_build_object('payment_id',p_id,'amount',p_amount,'received_on',p_date));return p_id;
end $$;
create function public.mzs_record_lease_payment(p_invoice uuid,p_id uuid,p_amount numeric,p_date date,p_reference text) returns uuid language sql security invoker set search_path='' as $$select mzs_private.record_lease_payment(p_invoice,p_id,p_amount,p_date,p_reference)$$;
create function mzs_private.reverse_lease_payment(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.mzs_lease_payments;c uuid;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'A correction reason is required';end if;
 select * into strict p from public.mzs_lease_payments where id=p_id;
 select contract_id into c from public.mzs_lease_invoices where id=p.invoice_id for update;
 update public.mzs_lease_payments set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=p_reason where id=p_id and reversed_at is null;
 if found then insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c,auth.uid(),'payment:reversed',jsonb_build_object('payment_id',p_id,'reason',p_reason));end if;
end $$;
create function public.mzs_reverse_lease_payment(p_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select mzs_private.reverse_lease_payment(p_id,p_reason)$$;
create function mzs_private.claim_lease_invoice_mail(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;c uuid;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501';end if;
 update public.mzs_lease_invoices set delivery_status='sending',delivery_token=gen_random_uuid(),delivery_started_at=now(),delivery_error=null
 where id=p_id and delivery_status in ('unsent','failed') returning delivery_token,contract_id into result,c;
 if result is null then raise exception 'Delivery already started or requires manual investigation';end if;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c,auth.uid(),'invoice:delivery_requested',jsonb_build_object('invoice_id',p_id));return result;
end $$;
create function public.mzs_claim_lease_invoice_mail(p_id uuid) returns uuid language sql security invoker set search_path='' as $$select mzs_private.claim_lease_invoice_mail(p_id)$$;
-- Only the trusted mail worker can attest SMTP outcomes; no browser role can mark a message sent.
create function mzs_private.finish_lease_invoice_mail(p_id uuid,p_token uuid,p_status text,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if p_status not in ('accepted','captured','failed','uncertain') then raise exception 'Invalid delivery outcome';end if;
 update public.mzs_lease_invoices set delivery_status=p_status,delivery_error=left(p_error,200),delivery_finished_at=now() where id=p_id and delivery_token=p_token and delivery_status='sending' returning contract_id into c;
 if c is null then return false;end if;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c,null,'invoice:delivery_result',jsonb_build_object('invoice_id',p_id,'status',p_status));return true;
end $$;
create function public.mzs_finish_lease_invoice_mail(p_id uuid,p_token uuid,p_status text,p_error text) returns boolean language sql security invoker set search_path='' as $$select mzs_private.finish_lease_invoice_mail(p_id,p_token,p_status,p_error)$$;
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mzs_private') and p.proname in ('issue_lease_invoice','mzs_issue_lease_invoice','record_lease_payment','mzs_record_lease_payment','reverse_lease_payment','mzs_reverse_lease_payment','claim_lease_invoice_mail','mzs_claim_lease_invoice_mail') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
revoke all on function mzs_private.finish_lease_invoice_mail(uuid,uuid,text,text),public.mzs_finish_lease_invoice_mail(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant usage on schema mzs_private to service_role;
grant execute on function mzs_private.finish_lease_invoice_mail(uuid,uuid,text,text),public.mzs_finish_lease_invoice_mail(uuid,uuid,text,text) to service_role;
-- New activations must be tied to a real issuer before monthly drafts are enabled.
create function mzs_private.require_lease_issuer() returns trigger language plpgsql security invoker set search_path='' as $$
begin if old.status='draft' and new.status='active' and new.issuer_id is null then raise exception 'Select a registered issuing entity before activating';end if;return new;end $$;
revoke all on function mzs_private.require_lease_issuer() from public,anon,authenticated,service_role;
create trigger b_require_lease_issuer before update on public.mzs_lease_contracts for each row execute function mzs_private.require_lease_issuer();
