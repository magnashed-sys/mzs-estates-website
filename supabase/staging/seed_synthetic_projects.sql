-- MZS STAGING ONLY: fictitious projects, not real properties or customer data.
-- DO NOT APPLY TO PRODUCTION.
insert into public.projects(slug,title,subtitle,location,status)
values
 ('staging-test-residence','TEST — Rental Residence','Fictional private rental for permission testing','Staging Test Region','active'),
 ('staging-test-development','TEST — Development Opportunity','Fictional investment and sale for access testing','Staging Test Region','active'),
 ('staging-test-capital','TEST — Capital Opportunity','Fictional financing opportunity for access testing','Staging Test Region','active')
on conflict(slug) do update
 set title=excluded.title,subtitle=excluded.subtitle,location=excluded.location,status=excluded.status;

insert into public.offerings(project_id,offering_type,title,status,summary)
select p.id, s.offering_type::public.offering_type,s.title,'active'::public.project_status,
       'STAGING ONLY — fictitious opportunity for security and notification testing'
from (values
 ('staging-test-residence','rental','TEST — Private Rental'),
 ('staging-test-development','investment','TEST — Investment'),
 ('staging-test-development','sale','TEST — Private Sale'),
 ('staging-test-capital','financing','TEST — Financing')
) s(slug,offering_type,title)
join public.projects p on p.slug=s.slug
on conflict(project_id,offering_type) do update
 set title=excluded.title,status=excluded.status,summary=excluded.summary;
