-- Historical settlements have a registration timestamp, but no invented bank date.
alter table public.mzs_booking_receipts
 add column receipt_type text not null default 'payment',
 alter column received_on drop not null;
alter table public.mzs_booking_receipts add constraint booking_receipt_date_kind check (
 (receipt_type='payment' and received_on is not null)
 or (receipt_type='historical_settlement' and received_on is null and length(btrim(coalesce(notes,'')))>=5)
);
comment on column public.mzs_booking_receipts.receipt_type is
 'payment = dated receipt; historical_settlement = owner-confirmed payment carried forward without known original payment date. Do not treat created_at as bank receipt date.';
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
    coalesce((select sum(r.amount) from public.mzs_booking_receipts r where r.booking_id=b.id and r.reversed_at is null),0)::numeric as paid,
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
    'Complimentary'::text,0::numeric,''::text,'/admin/owner-stays'::text,
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
      'checkOut',check_out,'status',status,'amount',amount,'paid',paid,'href',href,
      'archived',archived,'guestName',guest_name,'invoiceRecipient',invoice_recipient,'sourceRef',source_ref)
      ORDER BY check_in DESC,id DESC) FROM page),'[]'::jsonb),
   'years',coalesce((SELECT jsonb_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT extract(year from check_in)::integer y FROM entries) yy),'[]'::jsonb),
   'properties',coalesce((SELECT jsonb_agg(jsonb_build_object('id',project_id,'name',property) ORDER BY property)
     FROM (SELECT DISTINCT project_id,property FROM entries WHERE project_id IS NOT NULL) pp),'[]'::jsonb),
   'summary',jsonb_build_object(
       'agreed',(SELECT coalesce(sum(amount),0) FROM matching WHERE category='Guest booking' AND status='confirmed'),
       'paid',(SELECT coalesce(sum(paid),0) FROM matching WHERE category='Guest booking' AND status='confirmed'),
       'outstanding',(SELECT coalesce(sum(greatest(amount-paid,0)),0) FROM matching WHERE category='Guest booking' AND status='confirmed'),
       'credit',(SELECT coalesce(sum(greatest(paid-amount,0)),0) FROM matching WHERE category='Guest booking' AND status='confirmed'),
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
