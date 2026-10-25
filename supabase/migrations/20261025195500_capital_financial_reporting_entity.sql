-- Optional explicitly selected owner of loan income/expense for financial reports.
-- NULL keeps legacy loans in the Unassigned bucket without guessing ownership.
ALTER TABLE public.mzs_capital_deals
 ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.mzs_lease_issuers(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS mzs_capital_deals_entity_id_idx ON public.mzs_capital_deals(entity_id);
COMMENT ON COLUMN public.mzs_capital_deals.entity_id IS
 'Explicit reporting entity (existing issuing person/company); NULL means unassigned. Does not alter contractual lender or borrower.';
