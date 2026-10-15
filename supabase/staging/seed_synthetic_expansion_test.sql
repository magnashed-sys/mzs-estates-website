-- MZS STAGING ONLY. Fictional NEW project for automatic notification test.
-- This migration creates NO real customer accounts or project grants.
-- DO NOT RUN AGAINST MZS PRODUCTION.
insert into public.projects(slug,title,subtitle,location,status)
values ('staging-test-new-investment','TEST — New Investment Opportunity',
        'Fictional new allocation for automated access email testing',
        'Staging Test Region','active')
on conflict(slug) do nothing;

insert into public.offerings(project_id,offering_type,title,status,summary)
select p.id, 'investment'::public.offering_type,
       'TEST — New Investment',
       'active'::public.project_status,
       'STAGING ONLY — synthetic new project for assignment notification test'
from public.projects p where p.slug='staging-test-new-investment'
on conflict(project_id,offering_type) do nothing;
