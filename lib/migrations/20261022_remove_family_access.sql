BEGIN;
DO $retire_family$
BEGIN
  IF to_regprocedure('public.claim_family_code(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.claim_family_code(TEXT) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.family_status()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.family_status() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regclass('public.family_codes') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.family_codes FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regclass('public.family_claim_attempts') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.family_claim_attempts FROM PUBLIC, anon, authenticated;
  END IF;
END;
$retire_family$;
COMMIT;
