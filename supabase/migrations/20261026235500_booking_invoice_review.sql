alter table public.mzs_booking_invoice_drafts add column if not exists updated_at timestamptz not null default now();
alter table public.mzs_booking_invoice_drafts add column if not exists revision integer not null default 1;
alter table public.mzs_booking_invoice_drafts add column if not exists reviewed_at timestamptz;
alter table public.mzs_booking_invoice_drafts add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.mzs_booking_invoice_drafts drop constraint if exists mzs_booking_invoice_drafts_review_status_check;
alter table public.mzs_booking_invoice_drafts add constraint mzs_booking_invoice_drafts_review_status_check check(review_status in ('draft','reviewed'));
create or replace function public.mzs_admin_review_booking_invoice_draft(p_draft_id uuid,p_revision integer,p_status text,p_note text)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_revision integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 if p_status not in ('draft','reviewed') or length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Invalid review details'; end if;
 update public.mzs_booking_invoice_drafts
 set review_status=p_status, tax_note=btrim(p_note), reviewed_at=case when p_status='reviewed' then now() else null end,
 reviewed_by=case when p_status='reviewed' then auth.uid() else null end,
 updated_at=now(),revision=revision+1
 where id=p_draft_id and revision=p_revision returning revision into v_revision;
 if v_revision is null then raise exception 'Draft was changed. Reload before reviewing.'; end if;
 return v_revision;
end $$;
revoke all on function public.mzs_admin_review_booking_invoice_draft(uuid,integer,text,text) from public,anon;
grant execute on function public.mzs_admin_review_booking_invoice_draft(uuid,integer,text,text) to authenticated;
