-- Additive public editorial metadata. Existing RLS and append-only auditing stay in force.
alter table public.mzs_insights
 add column cover_image text not null default '',
 add column cover_alt text not null default '',
 add constraint insights_cover_path check(length(cover_image)<=200 and (cover_image='' or cover_image ~ '^/images/insights/[a-z0-9-]+[.]webp$')),
 add constraint insights_cover_alt check(length(cover_alt)<=300 and (cover_image='' or length(btrim(cover_alt))>0));
