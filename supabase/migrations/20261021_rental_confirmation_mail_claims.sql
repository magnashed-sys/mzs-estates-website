create table if not exists public.rental_confirmation_mail_claims (
 booking_id uuid primary key references public.rental_bookings(id) on delete cascade,
 claimed_at timestamptz not null default now(),
 delivery_status text not null default 'pending' check (delivery_status in ('pending','accepted','failed')),
 delivered_at timestamptz
);
alter table public.rental_confirmation_mail_claims enable row level security;
revoke all on public.rental_confirmation_mail_claims from anon,authenticated;
