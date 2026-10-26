-- Keep issuance disabled pending explicit administrative acceptance and PDF/tax workflow review.
revoke execute on function public.mzs_admin_issue_booking_invoice(uuid,integer) from authenticated;
