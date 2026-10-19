-- LOCAL PGLITE ONLY. Minimal relevant baseline, not a complete Supabase clone.
-- Production column types, request constraints, RLS and is_admin semantics
-- checked read-only on 2026-10-19. Auth and profile creation are test doubles.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema auth,public to anon,authenticated,service_role;
create table auth.users(id uuid primary key, aud text, role text, email text,
 raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create type public.user_role as enum ('client','partner','admin');
create table public.profiles (
 id uuid primary key references auth.users(id),
 role public.user_role not null default 'client', full_name text not null,
 email text not null, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 email_normalized text
);
create function public.is_admin() returns boolean language sql stable security definer
 set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.role='admin' and p.is_active=true)
$$;
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated
 using(id=(select auth.uid()));
create policy profiles_admin_all on public.profiles for all to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));
create function public.fixture_profile() returns trigger language plpgsql security definer
 set search_path='' as $$ begin
 insert into public.profiles(id,full_name,email,is_active)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Synthetic'),new.email,false);
 return new; end $$;
create trigger fixture_profile after insert on auth.users for each row execute function public.fixture_profile();
create function public.set_updated_at() returns trigger language plpgsql set search_path=''
 as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
