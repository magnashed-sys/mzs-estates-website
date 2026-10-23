alter table public.mzs_estate_units drop constraint mzs_estate_units_unit_type_check;
alter table public.mzs_estate_units add constraint mzs_estate_units_unit_type_check
 check (unit_type in ('studio','room','apartment','office','other'));
alter table public.mzs_estate_units add column rent_included boolean not null default false;
alter table public.mzs_estate_units add constraint estate_included_rent_zero
 check (not rent_included or monthly_rent=0);
