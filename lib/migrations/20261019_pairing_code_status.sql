BEGIN;
ALTER TABLE public.pairing_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.pairing_codes ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

UPDATE public.pairing_codes
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE used IS NOT TRUE
  AND (expires_at IS NULL OR expires_at <= created_at);

DROP POLICY IF EXISTS "Owners read their patient pairing codes" ON public.pairing_codes;
CREATE POLICY "Owners read their patient pairing codes"
  ON public.pairing_codes FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.pair_code = pairing_codes.code AND p.created_by = auth.uid()
  ));
GRANT SELECT ON public.pairing_codes TO authenticated;
COMMIT;
