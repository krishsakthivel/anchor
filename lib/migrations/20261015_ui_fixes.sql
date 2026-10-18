CREATE OR REPLACE FUNCTION valid_vital_reading(p_type TEXT, p_value TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE reading TEXT := btrim(p_value); parts TEXT[];
BEGIN
  IF p_type = 'blood_pressure' THEN
    IF reading !~ '^[0-9]{2,3}[[:space:]]*/[[:space:]]*[0-9]{2,3}$' THEN RETURN FALSE; END IF;
    parts := regexp_split_to_array(reading, '/');
    RETURN btrim(parts[1])::numeric > 0 AND btrim(parts[2])::numeric > 0;
  END IF;
  IF length(reading) > 32 OR reading !~ '^[0-9]+([.][0-9]+)?$' THEN RETURN FALSE; END IF;
  RETURN reading::numeric > 0;
END;
$$;

ALTER TABLE vital_signs DROP CONSTRAINT IF EXISTS vital_signs_valid_reading;
ALTER TABLE vital_signs ADD CONSTRAINT vital_signs_valid_reading
  CHECK (valid_vital_reading(type, value)) NOT VALID;

CREATE TABLE IF NOT EXISTS family_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{8}$'),
  used BOOLEAN DEFAULT FALSE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE family_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Caregivers manage family codes" ON family_codes;
CREATE POLICY "Caregivers manage family codes" ON family_codes FOR ALL
  USING (has_patient_access(patient_id, 'owner'))
  WITH CHECK (has_patient_access(patient_id, 'owner') AND caregiver_id = auth.uid());

CREATE TABLE IF NOT EXISTS family_claim_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE family_claim_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS family_claim_attempts_user_time_idx
  ON family_claim_attempts(user_id, attempted_at);

CREATE OR REPLACE FUNCTION claim_family_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code_row family_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR current_profile_role() IS DISTINCT FROM 'caregiver' THEN
    RAISE EXCEPTION 'Please sign in before joining a family';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  IF (SELECT count(*) FROM family_claim_attempts WHERE user_id = auth.uid()
      AND attempted_at > NOW() - INTERVAL '15 minutes') >= 20 THEN RETURN NULL; END IF;
  INSERT INTO family_claim_attempts(user_id) VALUES (auth.uid());
  SELECT * INTO code_row FROM family_codes
    WHERE code = btrim(p_code) AND used = FALSE AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF has_patient_access(code_row.patient_id, 'viewer') THEN
    RAISE EXCEPTION 'You already have caregiver access to this person';
  END IF;
  INSERT INTO caregiver_patient(caregiver_id, patient_id, permission_level)
    VALUES (auth.uid(), code_row.patient_id, 'family')
    ON CONFLICT (caregiver_id, patient_id) DO NOTHING;
  UPDATE family_codes SET used = TRUE WHERE id = code_row.id;
  RETURN code_row.patient_id;
END;
$$;
REVOKE ALL ON FUNCTION claim_family_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_family_code(TEXT) TO authenticated;
