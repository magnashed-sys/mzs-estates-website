begin;
do $test$
declare
 a uuid; p uuid; ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 i integer; result jsonb; rejected boolean:=false;
begin
 select id into a from public.profiles where role='admin' and is_active limit 1;
 select id into p from public.projects limit 1;
 if a is null or p is null then raise exception 'Staging fixtures unavailable'; end if;
 if exists(select 1 from rental_bookings where project_id=p and check_in>='2190-01-01' and check_in<'2191-01-01') then raise exception 'Fixture year occupied'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 for i in 1..4 loop
 insert into rental_bookings(id,project_id,user_id,check_in,check_out,status,is_test,guest_count,quoted_total_eur)
 values(ids[i],p,a,date '2190-01-01'+i*3,date '2190-01-02'+i*3,'confirmed',false,1,i*100);
 end loop;
 insert into mzs_booking_receipts(booking_id,amount,received_on,reference,notes,recorded_by,receipt_type)
 values(ids[1],100,null,'historical-test','Owner confirmed historical payment',a,'historical_settlement');
 insert into mzs_booking_receipts(booking_id,amount,received_on,reference,recorded_by)
 values(ids[2],100,current_date,'deposit-test',a),(ids[4],450,current_date,'overpayment-test',a);
 insert into mzs_booking_receipts(booking_id,amount,received_on,reference,recorded_by,reversed_at,reversed_by,reversal_reason)
 values(ids[2],50,current_date,'reversed-test',a,now(),a,'Reversed fixture');
 begin
 insert into mzs_booking_receipts(booking_id,amount,received_on,reference,recorded_by)
 values(ids[3],10,null,'invalid-date-test',a);
 exception when check_violation then rejected:=true; end;
 if not rejected then raise exception 'Normal receipt accepted without payment date'; end if;
 result:=mzs_admin_bookings_search_v2(p_year=>2190,p_property=>p,p_status=>'confirmed',p_limit=>1);
 if (result->>'total')::integer<>4 or jsonb_array_length(result->'items')<>1
  or (result#>>'{summary,agreed}')::numeric<>1000
  or (result#>>'{summary,paid}')::numeric<>650
  or (result#>>'{summary,outstanding}')::numeric<>400
  or (result#>>'{summary,credit}')::numeric<>50 then raise exception 'Filtered totals/pagination failed: %',result; end if;
 result:=mzs_admin_bookings_search_v2(p_query=>ids[2]::text);
 if (result->>'total')::integer<>1 or (result#>>'{items,0,paid}')::numeric<>100
  or (result#>>'{summary,agreed}')::numeric<>200
  or (result#>>'{summary,outstanding}')::numeric<>100 then raise exception 'Deposit/search/reversal failed: %',result; end if;
 result:=mzs_admin_bookings_search_v2(p_query=>ids[1]::text);
 if (result#>>'{items,0,paid}')::numeric<>100 or (result#>>'{summary,outstanding}')::numeric<>0 then raise exception 'Historical settlement not included'; end if;
 result:=mzs_admin_bookings_search_v2(p_query=>ids[3]::text);
 if (result#>>'{items,0,paid}')::numeric<>0 or (result#>>'{summary,outstanding}')::numeric<>300 then raise exception 'Unpaid booking incorrect'; end if;
end $test$;
rollback;
