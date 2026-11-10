-- Retain previous attempts before an explicitly authorized operator retry.
-- No application role may archive/reset a delivery or trigger a retry.
create table public.mzs_capital_reminder_attempt_history (
 id bigint generated always as identity primary key,
 instalment_id uuid not null references public.mzs_capital_instalments(id),
 previous_attempt jsonb not null check (jsonb_typeof(previous_attempt)='object'),
 authorized_by uuid not null references public.profiles(id),
 reason text not null check (length(trim(reason))>=10),
 archived_at timestamptz not null default now()
);
alter table public.mzs_capital_reminder_attempt_history enable row level security;
revoke all on public.mzs_capital_reminder_attempt_history from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_capital_reminder_attempt_history_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_capital_reminder_attempt_history to authenticated;
create policy admin_read on public.mzs_capital_reminder_attempt_history for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
