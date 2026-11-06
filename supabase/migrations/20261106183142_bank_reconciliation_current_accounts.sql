-- Bank evidence and related-party current accounts. No statutory postings or duplicate receipt creation.
create table public.mzs_bank_accounts(
 id uuid primary key default gen_random_uuid(),issuer_id uuid not null references public.mzs_lease_issuers(id),
 name text not null check(length(btrim(name)) between 1 and 100),iban text not null check(iban ~ '^[A-Z]{2}[0-9A-Z]{13,32}$'),
 opening_on date not null check(opening_on between date '2000-01-01' and date '2099-12-31'),opening_cents bigint not null check(abs(opening_cents)<=100000000000),
 evidence text not null check(length(btrim(evidence)) between 3 and 1000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(iban)
);
create table public.mzs_bank_batches(
 id uuid primary key,account_id uuid not null references public.mzs_bank_accounts(id),fiscal_year integer not null check(fiscal_year between 2000 and 2099),
 filename text not null check(length(filename) between 1 and 150),sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),raw_base64 text not null check(length(raw_base64)<=699052),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),payload_hash text not null
);
create table public.mzs_bank_transactions(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.mzs_bank_accounts(id),batch_id uuid not null references public.mzs_bank_batches(id),
 row integer not null,booked_on date not null,description text not null check(length(description) between 1 and 1000),amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=100000000000),
 reference text not null default '' check(length(reference)<=200),balance_cents bigint check(abs(balance_cents)<=100000000000),fingerprint text not null,
 unique(batch_id,row)
);
create table public.mzs_bank_allocations(
 id uuid primary key,issuer_id uuid not null references public.mzs_lease_issuers(id),transaction_id uuid references public.mzs_bank_transactions(id),
 booked_on date not null,kind text not null check(kind in ('purchase','sale','current_account','other','opening','private_payment','adjustment')),
 amount_cents bigint not null check(abs(amount_cents)<=100000000000),target_source text,target_id uuid,person_id uuid references public.mzs_lease_relationships(id),
 note text not null check(length(btrim(note)) between 3 and 1000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 check((kind in ('current_account','opening','private_payment','adjustment'))=(person_id is not null)),
 check((kind in ('purchase','sale','current_account','other'))=(transaction_id is not null)),
 check((kind in ('purchase','sale','private_payment'))=(target_id is not null)),check((target_id is null)=(target_source is null)),
 check(amount_cents<>0 or kind='opening')
);
create table public.mzs_bank_reversals(
 allocation_id uuid primary key references public.mzs_bank_allocations(id),reason text not null check(length(btrim(reason)) between 8 and 1000),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.mzs_bank_batch_voids(batch_id uuid primary key references public.mzs_bank_batches(id),reason text not null check(length(btrim(reason)) between 8 and 1000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index on public.mzs_bank_transactions(account_id,booked_on);
create index on public.mzs_bank_allocations(issuer_id,booked_on);
create index on public.mzs_bank_allocations(transaction_id);
create index on public.mzs_bank_allocations(target_source,target_id);
create index on public.mzs_bank_allocations(person_id);
create function mzs_private.bank_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Bank evidence is immutable; record a correction';end$$;
alter table public.mzs_bank_accounts enable row level security;
revoke all on public.mzs_bank_accounts from public,anon,authenticated;
grant select on public.mzs_bank_accounts to authenticated;
create policy admin_read on public.mzs_bank_accounts for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_accounts for each row execute function mzs_private.bank_immutable();
alter table public.mzs_bank_batches enable row level security;
revoke all on public.mzs_bank_batches from public,anon,authenticated;
grant select on public.mzs_bank_batches to authenticated;
create policy admin_read on public.mzs_bank_batches for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_batches for each row execute function mzs_private.bank_immutable();
alter table public.mzs_bank_transactions enable row level security;
revoke all on public.mzs_bank_transactions from public,anon,authenticated;
grant select on public.mzs_bank_transactions to authenticated;
create policy admin_read on public.mzs_bank_transactions for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_transactions for each row execute function mzs_private.bank_immutable();
alter table public.mzs_bank_allocations enable row level security;
revoke all on public.mzs_bank_allocations from public,anon,authenticated;
grant select on public.mzs_bank_allocations to authenticated;
create policy admin_read on public.mzs_bank_allocations for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_allocations for each row execute function mzs_private.bank_immutable();
alter table public.mzs_bank_reversals enable row level security;
revoke all on public.mzs_bank_reversals from public,anon,authenticated;
grant select on public.mzs_bank_reversals to authenticated;
create policy admin_read on public.mzs_bank_reversals for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_reversals for each row execute function mzs_private.bank_immutable();
alter table public.mzs_bank_batch_voids enable row level security;
revoke all on public.mzs_bank_batch_voids from public,anon,authenticated;
grant select on public.mzs_bank_batch_voids to authenticated;
create policy admin_read on public.mzs_bank_batch_voids for select to authenticated using ((select public.is_admin()));
create trigger immutable before update or delete on public.mzs_bank_batch_voids for each row execute function mzs_private.bank_immutable();
create function mzs_private.bank_targets(p_issuer uuid)
returns table(id uuid,source text,number text,issued_on date,gross_cents bigint) language sql stable security invoker set search_path='' as $$
 select id,'purchase',supplier_invoice_number,invoice_date,gross_cents from public.mzs_ops_expense_drafts where legal_entity_id=p_issuer
 union all select id,'lease',number,issued_on,round(total*100)::bigint from public.mzs_lease_invoices where issuer_id=p_issuer
 union all select id,'booking',number,issued_on,round(total*100)::bigint from public.mzs_booking_invoices where issuer_id=p_issuer
 union all select id,'service',number,issued_on,gross_cents from public.mzs_service_invoices where issuer_id=p_issuer
 union all select id,'external',number,issued_on,gross_cents from public.mzs_ops_external_sales_invoices where issuer_id=p_issuer
 union all select i.id,'archive',i.number,i.issued_on,i.gross_cents from public.mzs_invoice_archive i where i.issuer_id=p_issuer and not exists(select 1 from public.mzs_invoice_archive_exclusions e where e.invoice_id=i.id)
$$;
create function mzs_private.bank_write(p_action text,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare y public.mzs_accountancy_years;a public.mzs_bank_accounts;t public.mzs_bank_transactions;prior public.mzs_bank_allocations;
 result uuid;entry jsonb;amount bigint;used bigint;v_source text;target uuid;person uuid;kind text;dt date;note text;finger text;target_total bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p is null or jsonb_typeof(p)<>'object' then raise exception 'Invalid request';end if;
 select * into y from public.mzs_accountancy_years where id=(p->>'year_id')::uuid;
 if not found then raise exception 'Administration unavailable';end if;
 -- Serialize all writes for an issuer, including split allocations across bank accounts.
 perform pg_advisory_xact_lock(hashtextextended(y.issuer_id::text,0));
 result:=(p->>'id')::uuid;if result is null then raise exception 'Request ID required';end if;
 if p_action='account' then
  select * into a from public.mzs_bank_accounts where id=result;
  if found then
   if a.issuer_id<>y.issuer_id or a.name<>p->>'name' or a.iban<>p->>'iban' or a.opening_on<>(p->>'opening_on')::date or a.opening_cents<>(p->>'opening_cents')::bigint or a.evidence<>p->>'evidence' then raise exception 'Request ID conflict';end if;return result;
  end if;
  insert into public.mzs_bank_accounts(id,issuer_id,name,iban,opening_on,opening_cents,evidence,created_by) values(result,y.issuer_id,p->>'name',p->>'iban',(p->>'opening_on')::date,(p->>'opening_cents')::bigint,p->>'evidence',auth.uid());return result;
 elsif p_action='import' then
  select * into a from public.mzs_bank_accounts where id=(p->>'account_id')::uuid and issuer_id=y.issuer_id;
  if not found then raise exception 'Bank account unavailable';end if;
  if jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows') not between 1 and 1000 then raise exception 'Invalid bank rows';end if;
  if length(decode(p->>'raw_base64','base64')) not between 1 and 524288 or encode(sha256(decode(p->>'raw_base64','base64')),'hex') is distinct from p->>'sha256' then raise exception 'Source file hash mismatch';end if;
  if exists(select 1 from public.mzs_bank_batches where id=result) then
   if not exists(select 1 from public.mzs_bank_batches where id=result and account_id=a.id and sha256=p->>'sha256' and fiscal_year=y.fiscal_year and payload_hash=md5((p->'rows')::text) and not exists(select 1 from public.mzs_bank_batch_voids where batch_id=result)) then raise exception 'Request ID conflict';end if;return result;
  end if;
  if exists(select 1 from public.mzs_bank_batches where account_id=a.id and sha256=p->>'sha256' and not exists(select 1 from public.mzs_bank_batch_voids v where v.batch_id=mzs_bank_batches.id)) then raise exception 'File already imported';end if;
  insert into public.mzs_bank_batches(id,account_id,fiscal_year,filename,sha256,raw_base64,payload_hash,created_by) values(result,a.id,y.fiscal_year,p->>'filename',p->>'sha256',p->>'raw_base64',md5((p->'rows')::text),auth.uid());
  for entry in select value from jsonb_array_elements(p->'rows') loop
   dt:=(entry->>'booked_on')::date;amount:=(entry->>'amount_cents')::bigint;
   if extract(year from dt)<>y.fiscal_year or dt<a.opening_on or dt>(now() at time zone 'Europe/Madrid')::date then raise exception 'Transaction date outside permitted period';end if;
   finger:=md5(jsonb_build_array(dt,amount,entry->>'description',coalesce(entry->>'reference',''))::text);
   if exists(select 1 from public.mzs_bank_transactions where account_id=a.id and fingerprint=finger and not exists(select 1 from public.mzs_bank_batch_voids v where v.batch_id=mzs_bank_transactions.batch_id)) then raise exception 'Possible duplicate bank transaction; review overlapping exports';end if;
   insert into public.mzs_bank_transactions(account_id,batch_id,row,booked_on,description,amount_cents,reference,balance_cents,fingerprint)
    values(a.id,result,(entry->>'row')::integer,dt,entry->>'description',amount,coalesce(entry->>'reference',''),(entry->>'balance_cents')::bigint,finger);
  end loop;return result;
 elsif p_action='void_import' then
  if not exists(select 1 from public.mzs_bank_batches b join public.mzs_bank_accounts ba on ba.id=b.account_id where b.id=result and ba.issuer_id=y.issuer_id and b.fiscal_year=y.fiscal_year) then raise exception 'Import unavailable';end if;
  if exists(select 1 from public.mzs_bank_batch_voids where batch_id=result) then return result;end if;
  if exists(select 1 from public.mzs_bank_allocations x join public.mzs_bank_transactions tx on tx.id=x.transaction_id where tx.batch_id=result and not exists(select 1 from public.mzs_bank_reversals r where r.allocation_id=x.id)) then raise exception 'Reverse all allocations before voiding the import';end if;
  insert into public.mzs_bank_batch_voids values(result,p->>'reason',auth.uid(),now());return result;
 elsif p_action='reverse' then
  select * into prior from public.mzs_bank_allocations where id=result and issuer_id=y.issuer_id;
  if not found or prior.kind='opening' then raise exception 'Allocation unavailable or opening balance immutable';end if;
  if exists(select 1 from public.mzs_bank_reversals where allocation_id=result) then return result;end if;
  insert into public.mzs_bank_reversals values(result,p->>'reason',auth.uid(),now());return result;
 elsif p_action<>'allocate' then raise exception 'Unknown action';end if;
 kind:=p->>'kind';amount:=(p->>'amount_cents')::bigint;v_source:=nullif(p->>'target_source','');target:=nullif(p->>'target_id','')::uuid;person:=nullif(p->>'person_id','')::uuid;note:=btrim(p->>'note');dt:=(p->>'booked_on')::date;
 if amount is null or abs(amount)>100000000000 or kind is null or note is null or length(note) not between 3 and 1000 then raise exception 'Invalid allocation';end if;
 select * into prior from public.mzs_bank_allocations where id=result;
 if found then
  if prior.issuer_id<>y.issuer_id or prior.kind<>kind or prior.amount_cents<>amount or prior.note<>note or prior.transaction_id is distinct from nullif(p->>'transaction_id','')::uuid or prior.person_id is distinct from person or prior.target_id is distinct from target or prior.target_source is distinct from v_source or (prior.transaction_id is null and prior.booked_on is distinct from dt) then raise exception 'Request ID conflict';end if;
  if exists(select 1 from public.mzs_bank_reversals where allocation_id=result) then raise exception 'Allocation was reversed';end if;return result;
 end if;
 if kind in ('purchase','sale','current_account','other') then
  select tx.* into t from public.mzs_bank_transactions tx join public.mzs_bank_accounts ba on ba.id=tx.account_id where tx.id=(p->>'transaction_id')::uuid and ba.issuer_id=y.issuer_id;
  if not found or exists(select 1 from public.mzs_bank_batch_voids where batch_id=t.batch_id) then raise exception 'Bank transaction unavailable';end if;dt:=t.booked_on;
  if amount=0 or sign(amount)<>sign(t.amount_cents) then raise exception 'Allocation direction differs from bank transaction';end if;
  select coalesce(sum(abs(x.amount_cents)),0) into used from public.mzs_bank_allocations x where x.transaction_id=t.id and not exists(select 1 from public.mzs_bank_reversals r where r.allocation_id=x.id);
  if used+abs(amount)>abs(t.amount_cents) then raise exception 'Allocation exceeds remaining bank amount';end if;
 else
  if nullif(p->>'transaction_id','') is not null then raise exception 'Unexpected bank transaction';end if;
 end if;
 if dt is null or extract(year from dt)<>y.fiscal_year or dt>(now() at time zone 'Europe/Madrid')::date then raise exception 'Allocation date outside permitted period';end if;
 if person is not null then
  if not exists(select 1 from public.mzs_lease_relationships rel where rel.id=person and rel.kind='person') then raise exception 'Select an existing private person';end if;
  if kind='opening' then
   if exists(select 1 from public.mzs_bank_allocations where issuer_id=y.issuer_id and person_id=person) then raise exception 'An opening balance already exists';end if;
  elsif not exists(select 1 from public.mzs_bank_allocations op where op.issuer_id=y.issuer_id and op.person_id=person and op.kind='opening' and op.booked_on<=dt) then raise exception 'Record the evidenced opening balance first';end if;
 end if;
 if target is not null then
  if (kind in ('purchase','private_payment') and v_source is distinct from 'purchase') or (kind='sale' and v_source='purchase') then raise exception 'Wrong invoice type';end if;
  select gross_cents into target_total from mzs_private.bank_targets(y.issuer_id) q where q.id=target and q.source=v_source;
  if not found or target_total<=0 then raise exception 'Invoice unavailable for this entity';end if;
  if kind='purchase' and amount>=0 or kind in ('sale','private_payment') and amount<=0 then raise exception 'Wrong invoice payment direction';end if;
  select coalesce(sum(abs(x.amount_cents)),0) into used from public.mzs_bank_allocations x where x.issuer_id=y.issuer_id and x.target_id=target and x.target_source=v_source and not exists(select 1 from public.mzs_bank_reversals r where r.allocation_id=x.id);
  if used+abs(amount)>target_total then raise exception 'Allocation exceeds invoice total';end if;
 end if;
 insert into public.mzs_bank_allocations(id,issuer_id,transaction_id,booked_on,kind,amount_cents,target_source,target_id,person_id,note,created_by)
 values(result,y.issuer_id,t.id,dt,kind,amount,v_source,target,person,note,auth.uid());return result;
end$$;
create function public.mzs_bank_write(p_action text,p jsonb) returns uuid language sql security invoker set search_path='' as $$select mzs_private.bank_write(p_action,p)$$;
revoke all on function mzs_private.bank_write(text,jsonb),public.mzs_bank_write(text,jsonb),mzs_private.bank_targets(uuid),mzs_private.bank_immutable() from public,anon,authenticated;
grant execute on function mzs_private.bank_write(text,jsonb),public.mzs_bank_write(text,jsonb) to authenticated;
create function mzs_private.bank_source(p_year uuid,p_originals boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare y public.mzs_accountancy_years;result jsonb;begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into y from public.mzs_accountancy_years where id=p_year;if not found then raise exception 'Administration unavailable';end if;
 if (select count(*) from public.mzs_bank_transactions t join public.mzs_bank_accounts a on a.id=t.account_id where a.issuer_id=y.issuer_id)>20000 or (select count(*) from public.mzs_bank_allocations where issuer_id=y.issuer_id)>40000 then raise exception 'Bank register exceeds export limit';end if;
 select jsonb_build_object('issuer_id',y.issuer_id,'year',y.fiscal_year,
 'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.name),'[]') from public.mzs_bank_accounts a where a.issuer_id=y.issuer_id),
 'batches',(select coalesce(jsonb_agg((case when p_originals then to_jsonb(b) else to_jsonb(b)-'raw_base64' end)||jsonb_build_object('voided_at',v.created_at,'void_reason',v.reason) order by b.created_at),'[]') from public.mzs_bank_batches b join public.mzs_bank_accounts a on a.id=b.account_id left join public.mzs_bank_batch_voids v on v.batch_id=b.id where a.issuer_id=y.issuer_id and b.fiscal_year=y.fiscal_year),
 'transactions',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('voided_at',v.created_at) order by t.booked_on,t.batch_id,t.row),'[]') from public.mzs_bank_transactions t join public.mzs_bank_accounts a on a.id=t.account_id left join public.mzs_bank_batch_voids v on v.batch_id=t.batch_id where a.issuer_id=y.issuer_id and t.booked_on<make_date(y.fiscal_year+1,1,1)),
 'allocations',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('reversed_at',r.created_at,'reversal_reason',r.reason) order by x.booked_on,x.created_at),'[]') from public.mzs_bank_allocations x left join public.mzs_bank_reversals r on r.allocation_id=x.id where x.issuer_id=y.issuer_id),
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.mzs_lease_relationships where kind='person'),
 'targets',(select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('allocated_cents',(select coalesce(sum(abs(x.amount_cents)),0) from public.mzs_bank_allocations x where x.issuer_id=y.issuer_id and x.target_source=q.source and x.target_id=q.id and not exists(select 1 from public.mzs_bank_reversals r where r.allocation_id=x.id))) order by q.issued_on desc,q.number),'[]') from mzs_private.bank_targets(y.issuer_id) q)
 ) into result;return result;
end$$;
create function public.mzs_bank_source(p_year uuid,p_originals boolean default false) returns jsonb language sql security invoker set search_path='' as $$select mzs_private.bank_source(p_year,p_originals)$$;
revoke all on function mzs_private.bank_source(uuid,boolean),public.mzs_bank_source(uuid,boolean) from public,anon,authenticated;
grant execute on function mzs_private.bank_source(uuid,boolean),public.mzs_bank_source(uuid,boolean) to authenticated;
