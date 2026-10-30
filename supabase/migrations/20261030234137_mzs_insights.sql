-- Public editorial content only. No property dossiers, attachments or private notes.
create table public.mzs_insights (
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null,
 locale text not null check(locale in ('en','nl','de','fr','es','it','da','nb','sv','fi','cs','sk','pl','hu','lt','uk','ro','bg','el','ru','tr','zh-CN','ar','pt-BR')),
 slug text not null check(length(slug) between 1 and 120 and slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$'),
 title text not null check(length(btrim(title)) between 1 and 180),
 summary text not null default '' check(length(summary)<=500),
 body text not null default '' check(length(body)<=60000),
 category text not null check(category in ('real-estate','private-capital','consultancy')),
 format text not null default 'article' check(format in ('article','guide','case')),
 region text not null default '' check(length(region)<=80),
 author text not null default '' check(length(author)<=120),
 sources text[] not null default '{}' check(cardinality(sources)<=10),
 seo_title text not null default '' check(length(seo_title)<=180),
 seo_description text not null default '' check(length(seo_description)<=320),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 publish_at timestamptz,
 content_updated_on date not null default current_date,
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 slug_locked boolean not null default false,
 unique(locale,slug), unique(article_id,locale),
 check(status<>'published' or (publish_at is not null and length(btrim(summary))>0 and length(btrim(body))>0 and length(btrim(author))>0))
);
create index mzs_insights_public_listing on public.mzs_insights(locale,category,publish_at desc,id) where status='published';
alter table public.mzs_insights enable row level security;
revoke all on public.mzs_insights from anon,authenticated;
grant select on public.mzs_insights to anon,authenticated;
grant insert,update on public.mzs_insights to authenticated;
create policy insights_public_read on public.mzs_insights for select to anon,authenticated using(status='published' and publish_at<=now());
create policy insights_admin_read on public.mzs_insights for select to authenticated using((select public.is_admin()));
create policy insights_admin_insert on public.mzs_insights for insert to authenticated with check((select public.is_admin()));
create policy insights_admin_update on public.mzs_insights for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));

create table public.mzs_insights_audit (
 id uuid primary key default gen_random_uuid(), insight_id uuid not null references public.mzs_insights(id),
 actor_id uuid not null, changed_at timestamptz not null default now(),
 before_data jsonb, after_data jsonb not null
);
create index mzs_insights_audit_article on public.mzs_insights_audit(insight_id,changed_at desc);
alter table public.mzs_insights_audit enable row level security;
revoke all on public.mzs_insights_audit from anon,authenticated;
grant select on public.mzs_insights_audit to authenticated;
create policy insights_audit_admin_read on public.mzs_insights_audit for select to authenticated using((select public.is_admin()));

create or replace function mzs_private.insights_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Active administrator required' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.article_id<>old.article_id or new.locale<>old.locale then raise exception 'Article and language cannot change'; end if;
  if old.slug_locked and new.slug<>old.slug then raise exception 'The URL is locked after publication is enabled'; end if;
  new.revision:=old.revision+1;
  new.slug_locked:=old.slug_locked or new.status='published';
 else
  new.revision:=1; new.slug_locked:=new.status='published';
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function mzs_private.insights_guard() from public,anon,authenticated;
create trigger insights_guard before insert or update on public.mzs_insights for each row execute function mzs_private.insights_guard();

-- Definer is restricted to an internal trigger, needed for an append-only audit.
create or replace function mzs_private.insights_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Active administrator required' using errcode='42501'; end if;
 insert into public.mzs_insights_audit(insight_id,actor_id,before_data,after_data)
 values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function mzs_private.insights_audit() from public,anon,authenticated;
create trigger insights_audit after insert or update on public.mzs_insights for each row execute function mzs_private.insights_audit();
