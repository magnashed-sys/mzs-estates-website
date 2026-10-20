-- No backfill: existing access does not cause unsolicited notifications.
alter table public.mzs_mail_outbox drop constraint mzs_mail_outbox_event_type_check;
alter table public.mzs_mail_outbox add constraint mzs_mail_outbox_event_type_check
 check(event_type in ('application_received','account_activated','new_project_access','capital_access_granted'));
alter table public.mzs_capital_client_access add column notification_revision integer not null default 0;

create function public.mzs_capital_access_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare activating boolean;
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 if TG_WHEN='BEFORE' then
  if TG_OP='INSERT' then
   activating:=new.is_active;
   new.notification_revision:=0;
  else
   activating:=new.is_active and not old.is_active;
   new.notification_revision:=old.notification_revision;
  end if;
  if activating then
   if not exists(select 1 from public.profiles where id=new.user_id and is_active and role in ('client','partner')) then
    raise exception 'Active relationship required' using errcode='23514';
   end if;
   new.notification_revision:=new.notification_revision+1;
  end if;
 else
  if TG_OP='INSERT' then activating:=new.is_active;
  else activating:=new.is_active and not old.is_active;
  end if;
  if activating then
   insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
    values(new.user_id,'capital_access_granted',jsonb_build_object('grant_id',new.id,'revision',new.notification_revision),
     'capital-grant:'||new.id::text||':'||new.notification_revision::text)
    on conflict(idempotency_key) do nothing;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.mzs_capital_access_notification() from public,anon,authenticated;
create trigger capital_access_notification_revision before insert or update on public.mzs_capital_client_access
 for each row execute function public.mzs_capital_access_notification();
create trigger capital_access_notification_queue after insert or update on public.mzs_capital_client_access
 for each row execute function public.mzs_capital_access_notification();
