create or replace function public.mzs_admin_update_member_contact(p_user_id uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_key text; v_value text;
begin
  if auth.uid() is null or not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then raise exception 'Invalid contact data'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and role in ('client','partner')) then
    raise exception 'Relationship not found';
  end if;
  for v_key,v_value in select key,value #>> '{}' from jsonb_each(p_details) loop
    if v_key not in ('full_name','phone','street_address','house_number','address_addition','postal_code','city','region','country') then
      raise exception 'Unexpected field: %',v_key;
    end if;
    if jsonb_typeof(p_details->v_key) not in ('string','null') then raise exception 'Invalid field: %',v_key; end if;
    if length(coalesce(v_value,'')) > case v_key
       when 'full_name' then 160 when 'street_address' then 160
       when 'phone' then 40 when 'house_number' then 24
       when 'address_addition' then 80 when 'postal_code' then 24
       else 120 end then raise exception 'Field too long: %',v_key; end if;
  end loop;
  if nullif(btrim(p_details->>'full_name'),'') is null then raise exception 'Full name is required'; end if;
  update public.profiles set full_name=btrim(p_details->>'full_name') where id=p_user_id;
  insert into public.mzs_member_contact_details(user_id,phone,street_address,house_number,address_addition,postal_code,city,region,country)
  values (p_user_id,
    nullif(btrim(p_details->>'phone'),''),
    nullif(btrim(p_details->>'street_address'),''),
    nullif(btrim(p_details->>'house_number'),''),
    nullif(btrim(p_details->>'address_addition'),''),
    nullif(btrim(p_details->>'postal_code'),''),
    nullif(btrim(p_details->>'city'),''),
    nullif(btrim(p_details->>'region'),''),
    nullif(btrim(p_details->>'country'),''))
  on conflict(user_id) do update set
    phone=excluded.phone,street_address=excluded.street_address,
    house_number=excluded.house_number,address_addition=excluded.address_addition,
    postal_code=excluded.postal_code,city=excluded.city,region=excluded.region,country=excluded.country;
end $$;
revoke all on function public.mzs_admin_update_member_contact(uuid,jsonb) from public,anon;
grant execute on function public.mzs_admin_update_member_contact(uuid,jsonb) to authenticated;