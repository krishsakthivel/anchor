BEGIN;
ALTER TABLE public.pairing_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.pairing_codes ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

CREATE OR REPLACE FUNCTION public.reset_patient_pairing(p_patient_id UUID, p_code TEXT)
RETURNS public.pairing_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  patient_row public.patients%ROWTYPE;
  new_code_row public.pairing_codes%ROWTYPE;
  normalized_code TEXT := btrim(p_code);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF normalized_code IS NULL OR normalized_code !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'Pairing codes must contain eight digits';
  END IF;
  SELECT * INTO patient_row FROM public.patients
    WHERE id = p_patient_id AND created_by = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the care-plan owner can reset pairing'; END IF;
  IF EXISTS (SELECT 1 FROM public.pairing_codes WHERE code = normalized_code) THEN
    RAISE EXCEPTION 'That pairing code already exists. Please try again.';
  END IF;
  UPDATE public.pairing_codes SET used = TRUE
    WHERE code = patient_row.pair_code AND caregiver_id = auth.uid();
  INSERT INTO public.pairing_codes(caregiver_id, code, used, expires_at)
    VALUES (auth.uid(), normalized_code, FALSE, NOW() + INTERVAL '24 hours')
    RETURNING * INTO new_code_row;
  UPDATE public.patients SET paired_user_id = NULL, pair_code = normalized_code
    WHERE id = patient_row.id;
  RETURN new_code_row;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_patient_pairing(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_patient_pairing(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_patients_pairing(p_patient_id UUID, p_code TEXT)
RETURNS public.pairing_codes
LANGUAGE SQL SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.reset_patient_pairing(p_patient_id, p_code);
$$;
REVOKE ALL ON FUNCTION public.reset_patients_pairing(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_patients_pairing(UUID,TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
