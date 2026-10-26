create table if not exists public.mzs_booking_invoice_draft_audit(
 id bigint generated always as identity primary key,
 draft_id uuid not null references public.mzs_booking_invoice_drafts(id),
 admin_id uuid not null references public.profiles(id),
 previous_data jsonb not null,new_data jsonb not null,
 reason text not null,created_at timestamptz not null default now()
);
alter table public.mzs_booking_invoice_draft_audit enable row level security;
revoke all on public.mzs_booking_invoice_draft_audit from anon,authenticated;
grant select on public.mzs_booking_invoice_draft_audit to authenticated;
create policy booking_invoice_draft_audit_admin on public.mzs_booking_invoice_draft_audit for select to authenticated using((select public.is_admin()));
create or replace function public.mzs_admin_edit_booking_invoice_draft(
 p_id uuid,p_revision integer,p_issuer uuid,p_recipient text,p_email text,p_vat_percent numeric,p_tax_note text,p_reason text)
returns integer language plpgsql security definer set search_path=''
as $$
declare old_row public.mzs_booking_invoice_drafts%rowtype; v_issuer public.mzs_lease_issuers%rowtype; v_new integer; v_rate numeric; v_net numeric;v_vat numeric;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 if length(btrim(coalesce(p_recipient,''))) not between 1 and 250 or length(coalesce(p_email,''))>254
 or length(btrim(coalesce(p_tax_note,''))) not between 5 and 1000 or length(btrim(coalesce(p_reason,''))) not between 5 and 500
 or p_vat_percent is null or p_vat_percent<0 or p_vat_percent>100 then raise exception 'Invalid invoice fields'; end if;
 select * into old_row from public.mzs_booking_invoice_drafts where id=p_id and revision=p_revision and review_status='draft' for update;
 if not found then raise exception 'Draft changed or already reviewed; reload first'; end if;
 select * into v_issuer from public.mzs_lease_issuers where id=p_issuer;
 if not found then raise exception 'Unknown issuing entity'; end if;
 v_rate:=p_vat_percent/100;
 v_net:=round(old_row.gross_total/(1+v_rate),2);
 v_vat:=old_row.gross_total-v_net;
 update public.mzs_booking_invoice_drafts set issuer_id=p_issuer,recipient_name=btrim(p_recipient),
 recipient_email=nullif(btrim(p_email),''),vat_rate=v_rate,net_total=v_net,vat_total=v_vat,
 tax_note=btrim(p_tax_note),revision=revision+1,updated_at=now(),
 snapshot=jsonb_set(old_row.snapshot,'{issuer_name}',to_jsonb(v_issuer.name),true)
  || jsonb_build_object('issuer_prefix',v_issuer.prefix,'issuer_tax_id',v_issuer.tax_id)
 where id=p_id returning revision into v_new;
 insert into public.mzs_booking_invoice_draft_audit(draft_id,admin_id,previous_data,new_data,reason)
 values(p_id,auth.uid(),to_jsonb(old_row),
  (select to_jsonb(d) from public.mzs_booking_invoice_drafts d where d.id=p_id),btrim(p_reason));
 return v_new;
end $$;
revoke all on function public.mzs_admin_edit_booking_invoice_draft(uuid,integer,uuid,text,text,numeric,text,text) from public,anon;
grant execute on function public.mzs_admin_edit_booking_invoice_draft(uuid,integer,uuid,text,text,numeric,text,text) to authenticated;
