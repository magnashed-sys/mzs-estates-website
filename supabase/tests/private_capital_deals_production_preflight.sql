-- Read-only. Run on the explicitly selected Production project only.
-- All relation/function/bucket checks must be absent for first installation.
select name, to_regclass('public.' || name) as existing_relation
from unnest(array['mzs_capital_deals','mzs_capital_instalments',
 'mzs_capital_payments','mzs_capital_documents','mzs_capital_deal_audit']) as name;
select name, to_regprocedure('public.' || name || '()') as existing_function
from unnest(array['mzs_capital_payment_guard','mzs_capital_deal_log']) as name;
select id, public from storage.buckets where id='mzs-private-capital-documents';
select count(*) as active_full_admins from public.profiles
where role='admin' and is_active=true;
