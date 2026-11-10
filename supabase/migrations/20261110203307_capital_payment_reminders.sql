-- Opt-in only: no live recipients or financial data in source control.
-- Settings are provisioned by a trusted operator after owner review. Empty = off.
create table public.mzs_capital_reminder_settings (
 deal_id uuid primary key references public.mzs_capital_deals(id),
 enabled boolean not null default false,
 recipient_user_id uuid not null references public.profiles(id),
 recipient_email text not null check (recipient_email=lower(trim(recipient_email))),
 locale text not null default 'en' check (locale in ('en','nl')),
 first_due_date date not null,
 authorized_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.mzs_capital_reminder_deliveries (
 instalment_id uuid primary key references public.mzs_capital_instalments(id),
 snapshot jsonb not null,
 status text not null check (status in ('sending','accepted','failed','uncertain','cancelled')),
 claimed_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.mzs_capital_reminder_settings enable row level security;
alter table public.mzs_capital_reminder_deliveries enable row level security;
revoke all on public.mzs_capital_reminder_settings,public.mzs_capital_reminder_deliveries from public,anon,authenticated,service_role;
grant select on public.mzs_capital_reminder_settings,public.mzs_capital_reminder_deliveries to authenticated;
create policy admin_read on public.mzs_capital_reminder_settings for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy admin_read on public.mzs_capital_reminder_deliveries for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));

-- Current private snapshot: no truncated application queries and no speculative
-- interest calculation. Exact NUMERIC credits match allocateInterestCredits.
create function public.mzs_capital_reminder_snapshot(p_instalment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; today date:=(now() at time zone 'Europe/Madrid')::date;
begin
 with ledger as (
  select i.id,i.deal_id,i.due_date,i.amount,
   greatest(i.amount-coalesce(sum(p.amount) filter(where not p.is_void),0),0) deficit,
   greatest(coalesce(sum(p.amount) filter(where not p.is_void),0)-i.amount,0) surplus
  from public.mzs_capital_instalments i
  left join public.mzs_capital_payments p on p.instalment_id=i.id
  where i.kind='interest' and i.deal_id=(select deal_id from public.mzs_capital_instalments where id=p_instalment_id)
  group by i.id,i.deal_id,i.due_date,i.amount
 ), allocated as (
  select *,least(deficit,greatest(sum(surplus) over ()-coalesce(sum(deficit) over (
   order by due_date,id rows between unbounded preceding and 1 preceding),0),0)) credit
  from ledger
 )
 select jsonb_build_object('instalment_id',i.id,'deal_id',d.id,'due_date',i.due_date,
  'recipient_email',s.recipient_email,'recipient_name',p.full_name,'lender',d.lender,
  'title',d.title,'amount',i.deficit-i.credit,'credit',i.credit,'locale',s.locale)
 into result
 from allocated i
 join public.mzs_capital_deals d on d.id=i.deal_id
 join public.mzs_capital_reminder_settings s on s.deal_id=d.id
 join public.profiles p on p.id=s.recipient_user_id
 join auth.users u on u.id=p.id
 where i.id=p_instalment_id and s.enabled and d.direction='provided'
  and d.status in ('agreed','active') and d.currency='EUR'
  and i.due_date>=s.first_due_date and i.due_date between today+1 and today+5
  and i.deficit-i.credit>0 and p.is_active and p.role in ('client','partner')
  and lower(trim(p.email))=s.recipient_email and lower(trim(u.email))=s.recipient_email
  and u.email_confirmed_at is not null
  and exists(select 1 from public.profiles a where a.id=s.authorized_by and a.is_active and a.role='admin')
  and exists(select 1 from public.mzs_capital_client_access a where a.deal_id=d.id and a.user_id=p.id and a.party_role='borrower' and a.is_active);
 return result;
end $$;

create function public.mzs_due_capital_reminders() returns setof uuid
language sql security definer set search_path='' as $$
 select i.id from public.mzs_capital_instalments i
 join public.mzs_capital_reminder_settings s on s.deal_id=i.deal_id
 where s.enabled and i.kind='interest' and i.due_date>=s.first_due_date
  and i.due_date between (now() at time zone 'Europe/Madrid')::date+1 and (now() at time zone 'Europe/Madrid')::date+5
  and not exists(select 1 from public.mzs_capital_reminder_deliveries r where r.instalment_id=i.id)
  and public.mzs_capital_reminder_snapshot(i.id) is not null
 order by i.due_date,i.id limit 20;
$$;

create function public.mzs_claim_capital_reminder(p_instalment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; claimed uuid;
begin
 -- Shares the lock used when confirmed interest receipts are added/corrected.
 perform 1 from public.mzs_capital_deals where id=(select deal_id from public.mzs_capital_instalments where id=p_instalment_id) for update;
 snapshot:=public.mzs_capital_reminder_snapshot(p_instalment_id);
 if snapshot is null then return null; end if;
 insert into public.mzs_capital_reminder_deliveries(instalment_id,snapshot,status)
 values(p_instalment_id,snapshot,'sending') on conflict do nothing returning instalment_id into claimed;
 if claimed is null then return null; end if;
 return snapshot;
end $$;

create function public.mzs_finish_capital_reminder(p_instalment_id uuid,p_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin
 if p_status is null or p_status not in ('accepted','failed','uncertain','cancelled') then raise exception 'Invalid outcome'; end if;
 update public.mzs_capital_reminder_deliveries set status=p_status,completed_at=now()
 where instalment_id=p_instalment_id and status='sending' returning instalment_id into changed;
 return changed is not null;
end $$;
revoke all on function public.mzs_capital_reminder_snapshot(uuid),public.mzs_due_capital_reminders(),public.mzs_claim_capital_reminder(uuid),public.mzs_finish_capital_reminder(uuid,text) from public,anon,authenticated;
grant execute on function public.mzs_capital_reminder_snapshot(uuid),public.mzs_due_capital_reminders(),public.mzs_claim_capital_reminder(uuid),public.mzs_finish_capital_reminder(uuid,text) to service_role;
