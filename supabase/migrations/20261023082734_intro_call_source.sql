begin;
alter table public.mzs_intro_call_requests add column source text not null default 'private-capital' check(source in ('private-capital','real-estate'));
create function public.mzs_submit_intro_call_with_source(p_request_key uuid,p_name text,p_email text,p_phone text,p_message text,p_source text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_request public.mzs_intro_call_requests; v_events jsonb;
begin
  if p_source is null or p_source not in ('private-capital','real-estate') then raise exception 'Invalid source' using errcode='22023'; end if;
  if p_request_key is null or p_name is null or char_length(btrim(p_name)) not between 1 and 120
     or p_email is null or char_length(p_email) not between 3 and 254 or p_email ~ '[[:space:]]' or p_email not like '%@%.%'
     or p_phone is null or char_length(p_phone)>40 or p_message is null or char_length(p_message)>1000
     or p_name ~ E'[\r\n]' or p_phone ~ E'[\r\n]' then
    raise exception 'Invalid enquiry' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,1));
  select * into v_request from public.mzs_intro_call_requests where request_key=p_request_key;
  if found then
    if v_request.source<>p_source or v_request.email<>lower(p_email) or v_request.full_name<>btrim(p_name)
       or v_request.phone<>p_phone or v_request.message<>p_message then
      raise exception 'Request key already used' using errcode='22023';
    end if;
  else
    if not exists(select 1 from public.profiles where role='admin' and is_active=true and email is not null and email like '%@%.%') then
      raise exception 'No notification recipient configured';
    end if;
    insert into public.mzs_intro_call_requests(request_key,full_name,email,phone,message,source)
      values(p_request_key,btrim(p_name),lower(p_email),p_phone,p_message,p_source) returning * into v_request;
    insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
      select p.id,'intro_call_requested',jsonb_build_object('request_id',v_request.id,'source',p_source),
        'intro_call:'||v_request.id::text||':'||p.id::text
      from public.profiles p where p.role='admin' and p.is_active=true and p.email is not null and p.email like '%@%.%';
  end if;
  select coalesce(jsonb_agg(id),'[]'::jsonb) into v_events from public.mzs_mail_outbox
    where event_type='intro_call_requested' and payload->>'request_id'=v_request.id::text and status='pending';
  return jsonb_build_object('id',v_request.id,'events',v_events);
end $$;
revoke all on function public.mzs_submit_intro_call_with_source(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mzs_submit_intro_call_with_source(uuid,text,text,text,text,text) to service_role;

create or replace function public.mzs_submit_intro_call(p_request_key uuid,p_name text,p_email text,p_phone text,p_message text)
returns jsonb language sql security invoker set search_path='' as $$
select public.mzs_submit_intro_call_with_source(p_request_key,p_name,p_email,p_phone,p_message,'private-capital');
$$;
commit;
