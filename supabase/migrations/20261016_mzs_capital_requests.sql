-- Private MZS Capital requests. Run in Staging before Preview testing.
create table if not exists public.mzs_capital_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 request_type text not null check (request_type in ('capital','possibilities')),
 amount_eur numeric(15,2) not null check (amount_eur > 0 and amount_eur <= 100000000000),
 explanation text not null check (char_length(trim(explanation)) between 10 and 4000),
 status text not null default 'new' check (status in ('new','in_review','contacted','closed')),
 email_status text not null default 'pending' check (email_status in ('pending','accepted','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mzs_capital_requests_created_idx on public.mzs_capital_requests(created_at desc);
create index if not exists mzs_capital_requests_user_idx on public.mzs_capital_requests(user_id);
alter table public.mzs_capital_requests enable row level security;
revoke all on public.mzs_capital_requests from anon, authenticated;
grant select on public.mzs_capital_requests to authenticated;
drop policy if exists "capital requests readable by owner or active admin" on public.mzs_capital_requests;
create policy "capital requests readable by owner or active admin"
on public.mzs_capital_requests for select to authenticated
using (user_id = (select auth.uid()) or exists (
 select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='admin' and p.is_active=true
));