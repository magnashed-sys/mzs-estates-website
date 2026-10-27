
create table public.mzs_booking_archive(
 booking_id uuid primary key references public.rental_bookings(id) on delete restrict,
 archived_at timestamptz not null default now(),
 archived_by uuid not null references public.profiles(id),
 reason text not null check(length(btrim(reason)) between 5 and 500)
);
create table public.mzs_booking_cleanup_audit(
 id bigint generated always as identity primary key,
 booking_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 action text not null check(action in ('archive','restore','delete')),
 reason text not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index mzs_booking_cleanup_audit_booking on public.mzs_booking_cleanup_audit(booking_id,created_at);
alter table public.mzs_booking_archive enable row level security;
alter table public.mzs_booking_cleanup_audit enable row level security;
revoke all on public.mzs_booking_archive,public.mzs_booking_cleanup_audit from anon,authenticated;
grant select on public.mzs_booking_archive,public.mzs_booking_cleanup_audit to authenticated;
create policy archive_admin_read on public.mzs_booking_archive for select to authenticated using ((select public.is_admin()));
create policy cleanup_audit_admin_read on public.mzs_booking_cleanup_audit for select to authenticated using ((select public.is_admin()));

create function public.mzs_admin_booking_cleanup_plan(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.rental_bookings; a public.mzs_booking_archive; f record; linked boolean; blockers text[]:='{}'; can_archive boolean;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into b from public.rental_bookings where id=p_booking_id;
 if not found then raise exception 'Booking not found'; end if;
 select * into a from public.mzs_booking_archive where booking_id=b.id;
 if b.status not in ('cancelled','declined') then blockers:=array_append(blockers,'Only cancelled or declined records can be deleted here'); end if;
 for f in
  select c.conrelid::regclass as tbl,c.conkey,c.confkey,at.attname
  from pg_catalog.pg_constraint c
  left join pg_catalog.pg_attribute at on at.attrelid=c.conrelid and at.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.rental_bookings'::regclass
   and c.conrelid<>'public.mzs_booking_archive'::regclass
 loop
  if cardinality(f.conkey)<>1 or cardinality(f.confkey)<>1 then
   blockers:=array_append(blockers,'Additional linked history requires review'); continue;
  end if;
  execute format('select exists(select 1 from %s where %I=$1)',f.tbl,f.attname) into linked using b.id;
  if linked then blockers:=array_append(blockers,
    case f.tbl::text
     when 'mzs_booking_receipts' then 'Recorded payments'
     when 'mzs_booking_invoice_drafts' then 'Invoice drafts'
     when 'mzs_booking_invoices' then 'Invoices'
     when 'mzs_booking_legacy_sources' then 'Original imported confirmation'
     when 'mzs_owner_stay_requests' then 'Owner stay request'
     else 'Linked booking history' end);
  end if;
 end loop;
 can_archive:=b.status in ('cancelled','declined') or (b.status='confirmed' and b.check_out<=(timezone('Europe/Madrid',now()))::date);
 return jsonb_build_object('archived',a.booking_id is not null,'canArchive',can_archive,
  'canDelete',cardinality(blockers)=0,'blockers',to_jsonb(blockers),
  'fingerprint',md5(to_jsonb(b)::text||coalesce(to_jsonb(a)::text,'null')));
end $$;
revoke all on function public.mzs_admin_booking_cleanup_plan(uuid) from public,anon,service_role;
grant execute on function public.mzs_admin_booking_cleanup_plan(uuid) to authenticated;

create function public.mzs_admin_booking_cleanup(p_booking_id uuid,p_action text,p_reason text,p_fingerprint text)
returns text language plpgsql security definer set search_path='' as $$
declare b public.rental_bookings; plan jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('archive','restore','delete') or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Choose an action and provide a reason (5–500 characters)'; end if;
 select * into b from public.rental_bookings where id=p_booking_id for update;
 if not found then raise exception 'Booking not found'; end if;
 plan:=public.mzs_admin_booking_cleanup_plan(b.id);
 if p_fingerprint is distinct from plan->>'fingerprint' then raise exception 'Booking changed. Refresh before continuing'; end if;
 if p_action='archive' then
  if not (plan->>'canArchive')::boolean or (plan->>'archived')::boolean then raise exception 'Only completed, cancelled or declined bookings can be archived'; end if;
  insert into public.mzs_booking_archive(booking_id,archived_by,reason) values(b.id,auth.uid(),btrim(p_reason));
 elsif p_action='restore' then
  if not (plan->>'archived')::boolean then raise exception 'Booking is not archived'; end if;
  delete from public.mzs_booking_archive where booking_id=b.id;
 else
  if not (plan->>'canDelete')::boolean then raise exception 'Deletion blocked by booking status or linked history. Archive instead'; end if;
  delete from public.mzs_booking_archive where booking_id=b.id;
  delete from public.rental_bookings where id=b.id;
 end if;
 insert into public.mzs_booking_cleanup_audit(booking_id,actor_id,action,reason,snapshot)
 values(b.id,auth.uid(),p_action,btrim(p_reason),to_jsonb(b));
 return p_action;
end $$;
revoke all on function public.mzs_admin_booking_cleanup(uuid,text,text,text) from public,anon,service_role;
grant execute on function public.mzs_admin_booking_cleanup(uuid,text,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.mzs_admin_bookings_search_v2(p_query text DEFAULT ''::text, p_year integer DEFAULT NULL::integer, p_property uuid DEFAULT NULL::uuid, p_category text DEFAULT 'all'::text, p_status text DEFAULT 'all'::text, p_period text DEFAULT 'all'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 25, p_archive text DEFAULT 'active'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_now date := (timezone('Europe/Madrid',now()))::date;
 v_search text := lower(btrim(coalesce(p_query,'')));
 v_offset integer := greatest(coalesce(p_offset,0),0);
 v_limit integer := least(greatest(coalesce(p_limit,25),1),100);
 v_result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR (SELECT public.is_admin()) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 IF coalesce(p_archive,'active') NOT IN ('active','archived','all') OR length(v_search)>150 OR v_offset>100000 OR
   (p_year IS NOT NULL AND (p_year<1900 OR p_year>2200)) OR
   coalesce(p_category,'all') NOT IN ('all','Guest booking','Owner stay','Unavailable') OR
   coalesce(p_period,'all') NOT IN ('all','upcoming','current','past') OR
   coalesce(p_status,'all') NOT IN ('all','requested','confirmed','cancelled','declined','blocked','test_approved','approved','pending','rejected','withdrawn')
 THEN RAISE EXCEPTION 'Invalid booking search filters'; END IF;

 WITH entries AS MATERIALIZED (
   SELECT
    b.id, b.project_id, coalesce(p.title,'Property')::text AS property,
    CASE WHEN b.status='blocked' THEN 'Unavailable' ELSE 'Guest booking' END::text AS category,
    b.check_in, b.check_out, b.status, b.quoted_total_eur::numeric AS amount,
    coalesce(o.guest_name,s.source_guest_name,pr.full_name,pr.email,'Guest')::text AS guest_name,
    coalesce(o.invoice_recipient_name,s.invoice_recipient_name,'')::text AS invoice_recipient,
    CASE WHEN s.booking_id IS NOT NULL
      THEN concat(s.original_booking_number,' · ',s.source_key)
      ELSE '' END::text AS source_ref,
    ('/admin/bookings/'||b.id::text)::text AS href,
    lower(concat_ws(' ',b.id::text,p.title,b.status,
       o.guest_name,s.source_guest_name,pr.full_name,pr.email,s.source_email,
       o.invoice_recipient_name,s.invoice_recipient_name,
       s.original_booking_number,s.source_key))::text AS search_blob,
    b.created_at, exists(select 1 from public.mzs_booking_archive a where a.booking_id=b.id) as archived
   FROM public.rental_bookings b
   LEFT JOIN public.projects p ON p.id=b.project_id
   LEFT JOIN public.profiles pr ON pr.id=b.user_id
   LEFT JOIN public.mzs_booking_legacy_sources s ON s.booking_id=b.id
   LEFT JOIN public.mzs_booking_legacy_overrides o ON o.booking_id=b.id
   WHERE NOT EXISTS(SELECT 1 FROM public.mzs_owner_stay_requests own WHERE own.booking_id=b.id)
   UNION ALL
   SELECT
    os.id,pp.project_id,coalesce(p.title,'Property')::text,
    'Owner stay'::text,
    os.check_in,os.check_out,os.status,0::numeric,
    coalesce(pro.full_name,pro.email,'Owner / partner')::text,
    'Complimentary'::text,''::text,'/admin/owner-stays'::text,
    lower(concat_ws(' ',os.id::text,p.title,os.status,pro.full_name,pro.email,'owner stay'))::text,
    os.created_at, exists(select 1 from public.mzs_booking_archive a where a.booking_id=os.booking_id)
   FROM public.mzs_owner_stay_requests os
   JOIN public.mzs_property_partners pp ON pp.id=os.partner_id
   JOIN public.projects p ON p.id=pp.project_id
   LEFT JOIN public.profiles pro ON pro.id=pp.profile_id
 ),
 matching AS MATERIALIZED (
   SELECT * FROM entries e
   WHERE (coalesce(p_archive,'active')='all' OR e.archived=(p_archive='archived'))
     AND (v_search='' OR strpos(e.search_blob,v_search)>0)
     AND (p_year IS NULL OR (e.check_in>=make_date(p_year,1,1) AND e.check_in<make_date(p_year+1,1,1)))
     AND (p_property IS NULL OR e.project_id=p_property)
     AND (coalesce(p_category,'all')='all' OR e.category=p_category)
     AND (coalesce(p_status,'all')='all' OR e.status=p_status)
     AND (coalesce(p_period,'all')='all'
         OR (p_period='upcoming' AND e.check_in>=v_now)
         OR (p_period='current' AND e.check_in<=v_now AND e.check_out>v_now)
         OR (p_period='past' AND e.check_out<=v_now))
 ),
 page AS (
   SELECT * FROM matching ORDER BY check_in DESC,id DESC LIMIT v_limit OFFSET v_offset
 )
 SELECT jsonb_build_object(
   'total',(SELECT count(*) FROM matching),
   'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',id,'category',category,'property',property,'checkIn',check_in,
      'checkOut',check_out,'status',status,'amount',amount,'href',href,
      'archived',archived,'guestName',guest_name,'invoiceRecipient',invoice_recipient,'sourceRef',source_ref)
      ORDER BY check_in DESC,id DESC) FROM page),'[]'::jsonb),
   'years',coalesce((SELECT jsonb_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT extract(year from check_in)::integer y FROM entries) yy),'[]'::jsonb),
   'properties',coalesce((SELECT jsonb_agg(jsonb_build_object('id',project_id,'name',property) ORDER BY property)
     FROM (SELECT DISTINCT project_id,property FROM entries WHERE project_id IS NOT NULL) pp),'[]'::jsonb),
   'summary',jsonb_build_object(
       'guest',(SELECT count(*) FROM matching WHERE category='Guest booking'),
       'owner',(SELECT count(*) FROM matching WHERE category='Owner stay'),
       'blocked',(SELECT count(*) FROM matching WHERE category='Unavailable'),
       'requested',(SELECT count(*) FROM matching WHERE status='requested')
   ),
   'offset',v_offset,'limit',v_limit
 ) INTO v_result;
 RETURN v_result;
END
$function$
;
revoke all on function public.mzs_admin_bookings_search_v2(text,integer,uuid,text,text,text,integer,integer,text) from public,anon,service_role;
grant execute on function public.mzs_admin_bookings_search_v2(text,integer,uuid,text,text,text,integer,integer,text) to authenticated;
