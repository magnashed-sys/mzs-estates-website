-- Capital interest prepayments: full received cash is recorded once, and a
-- separate read-only ledger offsets outstanding and future interest periods.
-- The original immutable ledger audit remains intact on corrections.
CREATE OR REPLACE FUNCTION public.mzs_capital_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  planned numeric;
  paid numeric;
  item_kind text;
  loan_id uuid;
  overall_due numeric;
  overall_paid numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF old.is_void OR NOT new.is_void
      OR (to_jsonb(new)-'is_void'-'void_reason') <> (to_jsonb(old)-'is_void'-'void_reason')
    THEN
      RAISE EXCEPTION 'Payment records are immutable; void once with a reason' USING ERRCODE='22023';
    END IF;
    RETURN new;
  END IF;
  IF new.is_void THEN
    RAISE EXCEPTION 'Cannot insert a void payment' USING ERRCODE='22023';
  END IF;
  IF new.paid_on>current_date THEN
    RAISE EXCEPTION 'Confirmed payment date cannot be in the future' USING ERRCODE='22023';
  END IF;
  SELECT i.amount,i.kind,i.deal_id INTO planned,item_kind,loan_id
    FROM public.mzs_capital_instalments i WHERE i.id=new.instalment_id;
  IF loan_id IS NULL THEN
    RAISE EXCEPTION 'Instalment unavailable' USING ERRCODE='42501';
  END IF;
  -- Serialize interest receipts for the whole dossier; separate interest
  -- periods may legitimately have a carryforward credit.
  PERFORM 1 FROM public.mzs_capital_deals d WHERE d.id=loan_id FOR UPDATE;
  IF item_kind='interest' THEN
    SELECT coalesce(sum(i.amount),0) INTO overall_due
      FROM public.mzs_capital_instalments i
      WHERE i.deal_id=loan_id AND i.kind='interest';
    SELECT coalesce(sum(p.amount),0) INTO overall_paid
      FROM public.mzs_capital_payments p
      JOIN public.mzs_capital_instalments i ON i.id=p.instalment_id
      WHERE i.deal_id=loan_id AND i.kind='interest' AND NOT p.is_void;
    IF overall_paid+new.amount>overall_due THEN
      RAISE EXCEPTION 'Interest receipt exceeds all outstanding and future scheduled interest' USING ERRCODE='22023';
    END IF;
  ELSE
    SELECT coalesce(sum(p.amount),0) INTO paid FROM public.mzs_capital_payments p
      WHERE p.instalment_id=new.instalment_id AND NOT p.is_void;
    IF paid+new.amount>planned THEN
      RAISE EXCEPTION 'Payment exceeds remaining scheduled amount' USING ERRCODE='22023';
    END IF;
  END IF;
  new.recorded_by:=auth.uid();
  new.created_at:=now();
  RETURN new;
END
$$;

-- Atomic audited correction of an existing interest receipt: VOID old +
-- INSERT corrected cash receipt, preserving original payment date/reference.
-- Invoker rights and explicit active-admin check; no service-role bypass.
CREATE OR REPLACE FUNCTION public.mzs_capital_correct_interest_receipt(
  p_deal_id uuid,
  p_payment_id uuid,
  p_new_payment_id uuid,
  p_expected_amount numeric,
  p_corrected_amount numeric,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  old_payment public.mzs_capital_payments%ROWTYPE;
  installment public.mzs_capital_instalments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=auth.uid() AND role='admin' AND is_active=true
  ) THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501';
  END IF;
  IF p_deal_id IS NULL OR p_payment_id IS NULL OR p_new_payment_id IS NULL
    OR p_payment_id=p_new_payment_id
    OR p_expected_amount IS NULL OR p_expected_amount<=0
    OR p_corrected_amount IS NULL OR p_corrected_amount<=0
    OR p_corrected_amount>99999999999999
    OR p_corrected_amount<>round(p_corrected_amount,2)
    OR length(trim(coalesce(p_reason,'')))<5
    OR length(trim(coalesce(p_reason,'')))>500
  THEN
    RAISE EXCEPTION 'Invalid correction details' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.mzs_capital_deals WHERE id=p_deal_id FOR UPDATE;
  SELECT p.* INTO old_payment FROM public.mzs_capital_payments p
  JOIN public.mzs_capital_instalments i ON i.id=p.instalment_id
  WHERE p.id=p_payment_id AND i.deal_id=p_deal_id FOR UPDATE OF p;
  IF NOT FOUND OR old_payment.is_void OR old_payment.amount<>p_expected_amount THEN
    RAISE EXCEPTION 'Original payment has changed or has already been corrected'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO installment FROM public.mzs_capital_instalments
  WHERE id=old_payment.instalment_id;
  IF installment.kind<>'interest' THEN
    RAISE EXCEPTION 'Only interest receipts support carryforward corrections' USING ERRCODE='22023';
  END IF;
  UPDATE public.mzs_capital_payments SET is_void=true,
    void_reason='Corrected receipt: ' || trim(p_reason)
    WHERE id=old_payment.id AND is_void=false;
  INSERT INTO public.mzs_capital_payments
    (id,instalment_id,amount,paid_on,reference)
  VALUES (p_new_payment_id,old_payment.instalment_id,p_corrected_amount,
    old_payment.paid_on,old_payment.reference);
  RETURN p_new_payment_id;
END
$$;

REVOKE ALL ON FUNCTION public.mzs_capital_correct_interest_receipt(uuid,uuid,uuid,numeric,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mzs_capital_correct_interest_receipt(uuid,uuid,uuid,numeric,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mzs_capital_correct_interest_receipt(uuid,uuid,uuid,numeric,numeric,text) TO authenticated;
