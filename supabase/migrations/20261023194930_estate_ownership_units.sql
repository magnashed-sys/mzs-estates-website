-- Additive private administration register. No tenant data in source control.
create table public.mzs_estate_properties (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
 name text not null check (length(trim(name)) between 2 and 200),
 address text not null check (length(trim(address)) between 2 and 300),
 city text not null check (length(trim(city)) between 2 and 120),
 country_code text not null check (country_code ~ '^[A-Z]{2}$'),
 owner_name text not null check (length(trim(owner_name)) between 2 and 200),
 ownership_kind text not null check (ownership_kind in ('personal','company')),
 currency text not null default 'EUR' check (currency='EUR'),
 rent_basis text not null check (length(trim(rent_basis)) between 2 and 1000),
 notes text not null default '' check (length(notes)<=4000),
 source_reference text not null check (length(trim(source_reference)) between 2 and 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.mzs_estate_units (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.mzs_estate_properties(id),
 address text not null check (length(trim(address)) between 2 and 300),
 unit_type text not null check (unit_type in ('studio','room','apartment','other')),
 tenant_name text check (tenant_name is null or length(trim(tenant_name)) between 2 and 200),
 monthly_rent numeric(14,2) not null check (monthly_rent>=0),
 utilities_advance numeric(14,2) check (utilities_advance>=0),
 sort_order integer not null default 0 check (sort_order>=0),
 source_reference text not null check (length(trim(source_reference)) between 2 and 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(property_id,address)
);
create index mzs_estate_units_order on public.mzs_estate_units(property_id,sort_order);
create table public.mzs_estate_audit (
 id bigint generated always as identity primary key,
 property_id uuid not null references public.mzs_estate_properties(id),
 table_name text not null, row_id uuid not null, actor_id uuid,
 action text not null check (action in ('INSERT','UPDATE')),
 source_reference text not null, old_record jsonb, new_record jsonb not null,
 created_at timestamptz not null default now()
);
create index mzs_estate_audit_property_time on public.mzs_estate_audit(property_id,created_at desc);

-- Read-only app access. Controlled imports run through the existing database
-- administration connection and trigger the same append-only audit history.
do $$ declare t text; begin
 foreach t in array array['mzs_estate_properties','mzs_estate_units','mzs_estate_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy estate_group_admin_read on public.%I for select to authenticated using ((select public.is_admin()))',t);
 end loop;
end $$;
revoke all on sequence public.mzs_estate_audit_id_seq from public,anon,authenticated,service_role;

create function public.mzs_estate_log() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare parent_id uuid;
begin
 if tg_table_name='mzs_estate_properties' then parent_id:=new.id;
 else parent_id:=new.property_id; end if;
 insert into public.mzs_estate_audit(property_id,table_name,row_id,actor_id,action,source_reference,old_record,new_record)
 values(parent_id,
  tg_table_name,new.id,auth.uid(),tg_op,new.source_reference,
  case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.mzs_estate_log() from public,anon,authenticated,service_role;
create trigger estate_property_audit after insert or update on public.mzs_estate_properties
 for each row execute function public.mzs_estate_log();
create trigger estate_unit_audit after insert or update on public.mzs_estate_units
 for each row execute function public.mzs_estate_log();
create trigger estate_property_updated before update on public.mzs_estate_properties
 for each row execute function public.set_updated_at();
create trigger estate_unit_updated before update on public.mzs_estate_units
 for each row execute function public.set_updated_at();
