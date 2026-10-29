begin;
set local lock_timeout='2s';
create table public.mzs_service_credit_drafts(id uuid primary key,invoice_id uuid not null references public.mzs_service_invoices(id),spec jsonb not null,preview jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table public.mzs_service_credit_notes(id uuid primary key references public.mzs_service_credit_drafts(id),invoice_id uuid not null references public.mzs_service_invoices(id),issuer_id uuid not null references public.mzs_lease_issuers(id),customer_id uuid not null references public.mzs_lease_relationships(id),number text not null,issued_on date not null,net_cents bigint not null check(net_cents>0),vat_cents bigint not null check(vat_cents>=0),gross_cents bigint not null check(gross_cents=net_cents+vat_cents),lines jsonb not null,payload jsonb not null,reason text not null,issued_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(issuer_id,number));
create index service_credit_draft_invoice on public.mzs_service_credit_drafts(invoice_id);
create index service_credit_draft_actor on public.mzs_service_credit_drafts(created_by);
create index service_credit_invoice on public.mzs_service_credit_notes(invoice_id);
create index service_credit_customer on public.mzs_service_credit_notes(customer_id);
create index service_credit_actor on public.mzs_service_credit_notes(issued_by);
do $$declare t text;begin foreach t in array array['mzs_service_credit_drafts','mzs_service_credit_notes'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using((select public.is_admin()))',t);
 execute format('create trigger immutable before update or delete on public.%I for each row execute function mzs_private.external_receipt_immutable()',t);
end loop;end $$;
create function mzs_private.service_credit_preview(p_invoice uuid,p_spec jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.mzs_service_invoices;l jsonb;original jsonb;idx integer;seen integer[]:='{}';n bigint;v bigint;on_c bigint;ov_c bigint;prior_n bigint;prior_v bigint;total_n bigint:=0;total_v bigint:=0;lines jsonb:='[]';pdf_lines jsonb:='[]';revision integer;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into i from public.mzs_service_invoices where id=p_invoice for update;if not found then raise exception 'Platform invoice not found' using errcode='22023';end if;
 if p_spec is null or jsonb_typeof(p_spec->'lines') is distinct from 'array' or coalesce(length(btrim(p_spec->>'reason')),0) not between 8 and 500 or pg_column_size(p_spec)>10000 then raise exception 'Provide credit lines and a reason of 8 to 500 characters' using errcode='22023';end if;
 if jsonb_array_length(p_spec->'lines') not between 1 and 30 then raise exception 'Select at least one line' using errcode='22023';end if;
 for l in select value from jsonb_array_elements(p_spec->'lines') loop
 if coalesce(l->>'index','') !~ '^[0-9]{1,2}$' or coalesce(l->>'net_cents','') !~ '^[0-9]{1,12}$' then raise exception 'Invalid credit line' using errcode='22023';end if;
 idx:=(l->>'index')::integer;n:=(l->>'net_cents')::bigint;original:=i.payload->'lines'->idx;
 if idx=any(seen) or original is null or n<=0 then raise exception 'Invalid or duplicate credit line' using errcode='22023';end if;seen:=array_append(seen,idx);
 on_c:=round((original->>'net')::numeric*100);ov_c:=round((original->>'tax')::numeric*100);
 select coalesce(sum((x->>'net_cents')::bigint),0),coalesce(sum((x->>'vat_cents')::bigint),0) into prior_n,prior_v from public.mzs_service_credit_notes c cross join lateral jsonb_array_elements(c.lines) x where c.invoice_id=p_invoice and (x->>'index')::integer=idx;
 if on_c is null or ov_c is null or on_c<=0 or ov_c<0 or prior_n+n>on_c then raise exception 'Credit exceeds the remaining original line amount' using errcode='22023';end if;
 v:=round(ov_c::numeric*(prior_n+n)/on_c)-prior_v;
 if v<0 or prior_v+v>ov_c then raise exception 'Invalid credit VAT allocation' using errcode='22023';end if;
 lines:=lines||jsonb_build_array(jsonb_build_object('index',idx,'net_cents',n,'vat_cents',v));
 pdf_lines:=pdf_lines||jsonb_build_array(jsonb_build_object('description',original->>'description','net',-n::numeric/100,'tax',-v::numeric/100,'total',-(n+v)::numeric/100,'vat',original->>'vat'));
 total_n:=total_n+n;total_v:=total_v+v;
 end loop;
 if total_n+total_v+(select coalesce(sum(gross_cents),0) from public.mzs_service_credit_notes where invoice_id=p_invoice)>i.gross_cents then raise exception 'Credit exceeds original invoice' using errcode='22023';end if;
 select count(*) into revision from public.mzs_service_credit_notes where invoice_id=p_invoice;
 return jsonb_build_object('revision',revision,'invoice_id',i.id,'original_number',i.number,'issuer_id',i.issuer_id,'customer_id',i.customer_id,'reason',btrim(p_spec->>'reason'),'net_cents',total_n,'vat_cents',total_v,'gross_cents',total_n+total_v,'lines',lines,'payload',i.payload||jsonb_build_object('subject','Credit for invoice '||i.number||' — '||btrim(p_spec->>'reason'),'subtotal',-total_n::numeric/100,'tax_total',-total_v::numeric/100,'lines',pdf_lines));
end $$;
create function mzs_private.create_service_credit_draft(p_id uuid,p_invoice uuid,p_spec jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.mzs_service_credit_drafts;v jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null then raise exception 'Request identifier required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,4));select * into d from public.mzs_service_credit_drafts where id=p_id;
 if found then if d.invoice_id=p_invoice and d.spec=p_spec then return p_id;end if;raise exception 'Request identifier already used' using errcode='22023';end if;
 v:=mzs_private.service_credit_preview(p_invoice,p_spec);
 insert into public.mzs_service_credit_drafts values(p_id,p_invoice,p_spec,v,auth.uid(),now());return p_id;
end $$;
create function mzs_private.issue_service_credit(p_draft uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.mzs_service_credit_drafts;v jsonb;e public.mzs_lease_issuers;num text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into d from public.mzs_service_credit_drafts where id=p_draft for update;if not found then raise exception 'Credit draft not found' using errcode='22023';end if;
 if exists(select 1 from public.mzs_service_credit_notes where id=p_draft) then return p_draft;end if;
 v:=mzs_private.service_credit_preview(d.invoice_id,d.spec);if v is distinct from d.preview then raise exception 'Another credit was issued. Create a fresh preview.' using errcode='22023';end if;
 select * into strict e from public.mzs_lease_issuers where id=(v->>'issuer_id')::uuid for update;
 num:=e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0');
 insert into public.mzs_service_credit_notes(id,invoice_id,issuer_id,customer_id,number,issued_on,net_cents,vat_cents,gross_cents,lines,payload,reason,issued_by) values(p_draft,d.invoice_id,e.id,(v->>'customer_id')::uuid,num,(now() at time zone 'Europe/Madrid')::date,(v->>'net_cents')::bigint,(v->>'vat_cents')::bigint,(v->>'gross_cents')::bigint,v->'lines',v->'payload',v->>'reason',auth.uid());
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;return p_draft;
end $$;
create function public.mzs_create_service_credit_draft(p_id uuid,p_invoice uuid,p_spec jsonb) returns uuid language sql security invoker set search_path='' as $$select mzs_private.create_service_credit_draft(p_id,p_invoice,p_spec)$$;
create function public.mzs_issue_service_credit(p_draft uuid) returns uuid language sql security invoker set search_path='' as $$select mzs_private.issue_service_credit(p_draft)$$;
do $$declare f record;begin for f in select p.oid::regprocedure id from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mzs_private') and p.proname in ('service_credit_preview','create_service_credit_draft','issue_service_credit','mzs_create_service_credit_draft','mzs_issue_service_credit') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.id);execute format('grant execute on function %s to authenticated',f.id);end loop;end $$;
create or replace function mzs_private.ops_external_number_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.mzs_lease_issuers where id=new.issuer_id for update;
 if not found then raise exception 'Unknown issuing entity';end if;
 if (tg_table_name<>'mzs_service_credit_notes' and exists(select 1 from public.mzs_service_credit_notes where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 (tg_table_name<>'mzs_lease_invoices' and exists(select 1 from public.mzs_lease_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 (tg_table_name<>'mzs_booking_invoices' and exists(select 1 from public.mzs_booking_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_ops_external_sales_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) or
 (tg_table_name<>'mzs_service_invoices' and exists(select 1 from public.mzs_service_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_invoice_archive where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) then
 raise exception 'Invoice number already registered for this entity' using errcode='23505';end if;
 return new;
end $$;

create trigger z_credit_number before insert on public.mzs_service_credit_notes for each row execute function mzs_private.ops_external_number_guard();
create or replace function mzs_private.record_service_invoice_receipt(p_id uuid,p_invoice uuid,p_amount_cents bigint,p_received_on date,p_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.mzs_service_invoices;prior public.mzs_service_invoice_receipts;paid bigint;ref text:=btrim(p_reference);
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_amount_cents is null or p_amount_cents not between 1 and 100000000000 or p_received_on is null or p_received_on<date '2000-01-01' or p_received_on>(now() at time zone 'Europe/Madrid')::date or ref is null or length(ref) not between 3 and 200 or ref ~ '[[:cntrl:]]' then raise exception 'Check amount, payment date and reference' using errcode='22023';end if;
 select * into inv from public.mzs_service_invoices where id=p_invoice for update;
 if not found or inv.status<>'issued' or inv.currency<>'EUR' then raise exception 'Standalone invoice not found' using errcode='22023';end if;
 select * into prior from public.mzs_service_invoice_receipts where id=p_id;
 if found then
  if prior.invoice_id<>p_invoice or prior.amount_cents<>p_amount_cents or prior.received_on<>p_received_on or prior.reference<>ref then raise exception 'Request identifier already used for different payment details' using errcode='22023';end if;
  if exists(select 1 from public.mzs_service_invoice_receipt_reversals where receipt_id=p_id) then raise exception 'This payment was reversed; refresh before recording a replacement' using errcode='22023';end if;
  return p_id;
 end if;
 if exists(select 1 from public.mzs_service_invoice_receipts r where r.invoice_id=p_invoice and lower(r.reference)=lower(ref) and not exists(select 1 from public.mzs_service_invoice_receipt_reversals v where v.receipt_id=r.id)) then raise exception 'An active payment with this reference already exists' using errcode='22023';end if;
 select coalesce(sum(r.amount_cents),0) into paid from public.mzs_service_invoice_receipts r where r.invoice_id=p_invoice and not exists(select 1 from public.mzs_service_invoice_receipt_reversals v where v.receipt_id=r.id);
 if paid+p_amount_cents>inv.gross_cents-(select coalesce(sum(gross_cents),0) from public.mzs_service_credit_notes where invoice_id=p_invoice) then raise exception 'Payment exceeds the remaining invoice balance; refresh the invoice' using errcode='22023';end if;
 insert into public.mzs_service_invoice_receipts(id,invoice_id,amount_cents,received_on,reference,recorded_by) values(p_id,p_invoice,p_amount_cents,p_received_on,ref,auth.uid());
 return p_id;
end $$;
create or replace function mzs_private.invoice_reminder_context(p_source text,p_invoice uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;c public.mzs_lease_relationships;e public.mzs_lease_issuers;paid bigint;n integer;balance bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_source='service' then
 select id,issuer_id,customer_id,number,due_on,gross_cents into r from public.mzs_service_invoices where id=p_invoice for update;
 if not found then return null;end if;
 select coalesce(sum(x.amount_cents),0),count(*) into paid,n from public.mzs_service_invoice_receipts x where x.invoice_id=p_invoice and not exists(select 1 from public.mzs_service_invoice_receipt_reversals z where z.receipt_id=x.id);
 balance:=r.gross_cents-paid-(select coalesce(sum(gross_cents),0) from public.mzs_service_credit_notes where invoice_id=p_invoice);
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
create or replace function public.mzs_ops_accountant_source(p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
 if (select count(*) from public.mzs_service_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Standalone export scope too large';end if;
 if (select count(*) from public.mzs_invoice_archive where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Imported export scope too large';end if;
 if (select count(*) from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 or (select count(*) from public.mzs_ops_external_sales_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 if (select count(*) from public.mzs_service_credit_notes where issuer_id=p_entity)>3000 then raise exception 'Credit scope too large';end if;
 select jsonb_build_object(
 'issuer',(select jsonb_build_object('id',id,'name',name) from public.mzs_lease_issuers where id=p_entity),
 'leases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,contract_id,number,issued_on,total from public.mzs_lease_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,booking_id,number,issued_on,total,net_total,vat_total from public.mzs_booking_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'external',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,batch_id,issuer_id,number,issued_on,net_cents::numeric/100 net_total,vat_cents::numeric/100 vat_total,gross_cents::numeric/100 total,status from public.mzs_ops_external_sales_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'rent_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.invoice_id,p.amount,p.received_on,p.reference,p.reversed_at from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'guest_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.booking_id,p.amount,p.received_on,p.reference,p.receipt_type,p.reversed_at from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'external_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id left join public.mzs_external_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'imported',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select i.id,i.issuer_id,i.number,i.issued_on,i.gross_cents,i.source_paid_cents,i.source_open_cents,exists(select 1 from public.mzs_invoice_archive_exclusions e where e.invoice_id=i.id) excluded from public.mzs_invoice_archive i where i.issuer_id=p_entity) x),'[]'::jsonb),
 'imported_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id left join public.mzs_archive_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,draft_id,issuer_id,number,issued_on,net_cents::numeric/100 net_total,vat_cents::numeric/100 vat_total,gross_cents::numeric/100 total,status from public.mzs_service_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'service_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id left join public.mzs_service_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'credit_notes',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,invoice_id,issuer_id,customer_id,number,issued_on,net_cents,vat_cents,gross_cents,reason from public.mzs_service_credit_notes where issuer_id=p_entity) x),'[]'::jsonb),
 'snapshot_at',statement_timestamp()) into result;
 return result;
end $fn$;
revoke all on function public.mzs_ops_accountant_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_accountant_source(uuid) to authenticated;





commit;
