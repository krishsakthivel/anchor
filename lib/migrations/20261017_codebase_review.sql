BEGIN;
DROP POLICY IF EXISTS "Caregivers read accessible medications" ON public.medications;
CREATE POLICY "Caregivers read accessible medications" ON public.medications
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.medications TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible medication_schedule" ON public.medication_schedule;
CREATE POLICY "Caregivers read accessible medication_schedule" ON public.medication_schedule
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.medication_schedule TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible tasks" ON public.tasks;
CREATE POLICY "Caregivers read accessible tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.tasks TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible reminders" ON public.reminders;
CREATE POLICY "Caregivers read accessible reminders" ON public.reminders
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.reminders TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "Caregivers read accessible emergency_contacts" ON public.emergency_contacts
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.emergency_contacts TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible care_notes" ON public.care_notes;
CREATE POLICY "Caregivers read accessible care_notes" ON public.care_notes
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.care_notes TO authenticated;

DROP POLICY IF EXISTS "Caregivers read accessible appointments" ON public.appointments;
CREATE POLICY "Caregivers read accessible appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.has_patient_access(patient_id, 'viewer'));
GRANT SELECT ON public.appointments TO authenticated;

CREATE OR REPLACE FUNCTION claim_patient_code(p_code TEXT)
RETURNS patients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_row pairing_codes%ROWTYPE;
  patient_row patients%ROWTYPE;
  caller_is_anonymous BOOLEAN;
  recent_attempts INTEGER;
  attempt_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(is_anonymous, FALSE)
    INTO caller_is_anonymous
  FROM auth.users
  WHERE id = auth.uid();

  IF caller_is_anonymous IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only a patient session can claim a pairing code';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  IF EXISTS (SELECT 1 FROM patients WHERE paired_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'This patient session is already paired';
  END IF;

  SELECT COUNT(*) INTO recent_attempts
  FROM pairing_attempts
  WHERE user_id = auth.uid()
    AND attempted_at > NOW() - INTERVAL '15 minutes';

  IF recent_attempts >= 20 THEN
    RETURN NULL;
  END IF;

  INSERT INTO pairing_attempts (user_id, succeeded)
  VALUES (auth.uid(), FALSE)
  RETURNING id INTO attempt_id;

  SELECT * INTO code_row
  FROM pairing_codes
  WHERE code = UPPER(TRIM(p_code))
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF code_row.expires_at <= NOW() THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = code_row.caregiver_id AND role = 'caregiver'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO patient_row
  FROM patients
  WHERE pair_code = code_row.code
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF patient_row.paired_user_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF code_row.used THEN
    RETURN NULL;
  END IF;

  UPDATE pairing_codes SET used = TRUE WHERE id = code_row.id;
  UPDATE patients
  SET paired_user_id = auth.uid()
  WHERE id = patient_row.id
  RETURNING * INTO patient_row;

  UPDATE pairing_attempts
  SET succeeded = TRUE
  WHERE id = attempt_id;

  RETURN patient_row;
END;
$$;


REVOKE ALL ON FUNCTION public.claim_patient_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_patient_code(TEXT) TO authenticated;
COMMIT;
