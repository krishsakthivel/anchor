CREATE TABLE family_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{8}$'),
  used BOOLEAN DEFAULT FALSE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE family_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers manage family codes"
  ON family_codes FOR ALL
  USING (has_patient_access(patient_id, 'owner'))
  WITH CHECK (has_patient_access(patient_id, 'owner') AND caregiver_id = auth.uid());

CREATE OR REPLACE FUNCTION claim_family_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_row family_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR current_profile_role() <> 'caregiver' THEN
    RAISE EXCEPTION 'Please sign in before joining a family';
  END IF;
  SELECT * INTO code_row
  FROM family_codes
  WHERE code = TRIM(p_code) AND used = FALSE AND expires_at > NOW()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That family code is invalid or expired';
  END IF;
  INSERT INTO caregiver_patient (caregiver_id, patient_id, permission_level)
  VALUES (auth.uid(), code_row.patient_id, 'family')
  ON CONFLICT (caregiver_id, patient_id) DO UPDATE SET permission_level = 'family';
  UPDATE family_codes SET used = TRUE WHERE id = code_row.id;
  RETURN code_row.patient_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_family_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_family_code(TEXT) TO authenticated;
