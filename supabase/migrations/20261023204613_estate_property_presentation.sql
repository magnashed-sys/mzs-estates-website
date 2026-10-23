alter table public.mzs_estate_properties
 add column ownership_since_year smallint check (ownership_since_year between 1800 and 2100),
 add column managing_agent_name text check (length(managing_agent_name) between 2 and 200),
 add column managing_agent_url text check (managing_agent_url ~ '^https://[^[:space:]]+$' and length(managing_agent_url)<=1000),
 add column managing_agent_logo text check (managing_agent_logo in ('kramer-and-partners'));

-- Small, optimised administration images remain inside the protected register.
-- No public bucket or repository assets expose privately supplied photographs.
create table public.mzs_estate_images (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.mzs_estate_properties(id),
 caption text not null check (length(caption) between 2 and 200),
 image_base64 text not null check (length(image_base64) between 4 and 700000 and image_base64 ~ '^[A-Za-z0-9+/]+={0,2}$'),
 sort_order integer not null check (sort_order between 1 and 20),
 source_reference text not null check (length(source_reference) between 2 and 1000),
 created_at timestamptz not null default now(),
 unique(property_id,sort_order)
);
alter table public.mzs_estate_images enable row level security;
revoke all on public.mzs_estate_images from public,anon,authenticated,service_role;
grant select on public.mzs_estate_images to authenticated;
create policy estate_images_admin_read on public.mzs_estate_images for select to authenticated
 using ((select public.is_admin()));
create trigger estate_image_audit after insert or update on public.mzs_estate_images
 for each row execute function public.mzs_estate_log();
