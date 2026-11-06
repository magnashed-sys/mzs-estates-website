-- Applications are created by the verified Auth registration trigger.
-- Preserve administrative review and the trusted service role.
begin;
drop policy if exists access_requests_public_insert on public.access_requests;
revoke insert on table public.access_requests from public, anon, authenticated;
grant insert on table public.access_requests to service_role;
commit;
