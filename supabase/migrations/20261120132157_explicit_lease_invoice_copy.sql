create function mzs_private.claim_lease_invoice_copy(p_id uuid, p_previous_start timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare original public.mzs_lease_invoices%rowtype;
declare attempt uuid := gen_random_uuid();
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required'; end if;
 select * into original from public.mzs_lease_invoices where id=p_id for update;
 if not found or original.delivery_status not in ('accepted','captured') or original.delivery_started_at is distinct from p_previous_start then raise exception 'Refresh the invoice before sending a copy'; end if;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record)
 values(original.contract_id, auth.uid(), 'invoice:copy_requested', jsonb_build_object('invoice_id',p_id,'previous_status',original.delivery_status,'previous_started_at',original.delivery_started_at,'previous_finished_at',original.delivery_finished_at,'attempt',attempt));
 update public.mzs_lease_invoices set delivery_status='sending',delivery_started_at=clock_timestamp(),delivery_token=attempt,delivery_finished_at=null,delivery_error=null where id=p_id;
 return attempt;
end $$;
create function public.mzs_claim_lease_invoice_copy(p_id uuid,p_previous_start timestamptz) returns uuid language sql set search_path='' as $$ select mzs_private.claim_lease_invoice_copy(p_id,p_previous_start) $$;
revoke all on function public.mzs_claim_lease_invoice_copy(uuid,timestamptz), mzs_private.claim_lease_invoice_copy(uuid,timestamptz) from public,anon;
grant execute on function public.mzs_claim_lease_invoice_copy(uuid,timestamptz), mzs_private.claim_lease_invoice_copy(uuid,timestamptz) to authenticated;
