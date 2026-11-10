alter table public.mzs_capital_reminder_deliveries add column delivery_result jsonb not null default '{}'::jsonb;
create function public.mzs_finish_capital_reminder(p_instalment_id uuid,p_status text,p_delivery_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin
 if p_status is null or p_status not in ('accepted','failed','uncertain','cancelled') or p_delivery_result is null or jsonb_typeof(p_delivery_result)<>'object' then raise exception 'Invalid outcome'; end if;
 if p_status='accepted' and (p_delivery_result->>'recipientAccepted' is distinct from 'true' or p_delivery_result->>'copyAccepted' is distinct from 'true') then raise exception 'Both recipients must be accepted'; end if;
 update public.mzs_capital_reminder_deliveries set status=p_status,completed_at=now(),delivery_result=p_delivery_result
 where instalment_id=p_instalment_id and status='sending' returning instalment_id into changed;
 return changed is not null;
end $$;
revoke all on function public.mzs_finish_capital_reminder(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mzs_finish_capital_reminder(uuid,text,jsonb) to service_role;
create or replace function public.mzs_finish_capital_reminder(p_instalment_id uuid,p_status text) returns boolean
language sql security definer set search_path='' as $$
 select public.mzs_finish_capital_reminder(p_instalment_id,p_status,'{}'::jsonb);
$$;
