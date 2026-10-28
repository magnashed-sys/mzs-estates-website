begin;
do $fixture$ declare issuer uuid;issuer_name text;b uuid:=gen_random_uuid();admin_id uuid;src jsonb;begin
 select id,name into strict issuer,issuer_name from public.mzs_lease_issuers order by id limit 1;
 select id into strict admin_id from public.profiles where role='admin' and is_active order by id limit 1;
 src:=jsonb_build_object('Status','Verzonden','Verkoopfactuur','Synthetic archive customer','Nummer','SYN-GRIPP-'||b,'Datum','2026-01-15','Rapportagedatum','2026-01-14','Conceptdatum','2026-01-13','Vervaldatum','2026-01-28','Identiteit',issuer_name,'Onderwerp','Synthetic import','Omschrijving','Fictional acceptance record','Referentie klant','','Totaal excl. BTW','100','Totaal incl. BTW','121','Totaal reeds betaald','21','Totaal openstaand','100','isopenstaand','Ja');
 insert into public.mzs_invoice_archive_batches(id,issuer_id,source_system,source_name,source_file_id,source_sha256,source_columns,currency,currency_basis,expected_rows,expected_net_cents,expected_gross_cents,expected_paid_cents,expected_open_cents,authorization_reference)
 values(b,issuer,'Gripp','Synthetic.csv','libfile_synthetic',repeat('c',64),array(select jsonb_object_keys(src)),'EUR','import_currency_not_in_source',2,9000,10890,890,10000,'Synthetic rollback-only import rehearsal');
 insert into public.mzs_invoice_archive(batch_id,source_row,raw_source) values(b,2,src);
 src:=src||jsonb_build_object('Nummer','SYN-CREDIT-'||b,'Totaal excl. BTW','-10','Totaal incl. BTW','-12.10','Totaal reeds betaald','-12.10','Totaal openstaand','0','isopenstaand','Nee');
 insert into public.mzs_invoice_archive(batch_id,source_row,raw_source) values(b,3,src);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
end $fixture$;
set constraints all immediate;
set local role authenticated;
select jsonb_build_object('rows',(public.mzs_invoice_archive_source(2026,'Synthetic archive customer'))->'totals'->'count','totals',(public.mzs_invoice_archive_source(2026,'Synthetic archive customer'))->'totals') as rehearsal;
rollback;
