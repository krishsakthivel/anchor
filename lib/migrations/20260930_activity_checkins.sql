CREATE TABLE IF NOT EXISTS checkin_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  tag_token UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES daily_plans(id) ON DELETE CASCADE NOT NULL,
  block_index INTEGER NOT NULL CHECK (block_index >= 0),
  location_id UUID REFERENCES checkin_locations(id) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, block_index)
);

ALTER TABLE checkin_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers manage own check-in places" ON checkin_locations;
CREATE POLICY "Caregivers manage own check-in places"
  ON checkin_locations FOR ALL
  USING (caregiver_id = auth.uid() AND current_profile_role() = 'caregiver')
  WITH CHECK (caregiver_id = auth.uid() AND current_profile_role() = 'caregiver');

DROP POLICY IF EXISTS "Patients read own activity check-ins" ON activity_checkins;
CREATE POLICY "Patients read own activity check-ins"
  ON activity_checkins FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE paired_user_id = auth.uid()));

DROP POLICY IF EXISTS "Caregivers read activity check-ins" ON activity_checkins;
CREATE POLICY "Caregivers read activity check-ins"
  ON activity_checkins FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE OR REPLACE FUNCTION check_in_activity(p_plan_id UUID, p_block_index INTEGER, p_tag_token TEXT)
RETURNS activity_checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_row daily_plans%ROWTYPE;
  place_row checkin_locations%ROWTYPE;
  block JSONB;
  result_row activity_checkins%ROWTYPE;
BEGIN
  SELECT * INTO plan_row FROM daily_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM patients WHERE id = plan_row.patient_id AND paired_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'This schedule is not available to your patient account';
  END IF;
  IF ABS(plan_row.plan_date - CURRENT_DATE) > 1 THEN
    RAISE EXCEPTION 'This schedule is no longer current';
  END IF;
  IF p_block_index IS NULL OR p_block_index < 0 OR p_block_index >= jsonb_array_length(plan_row.blocks) THEN
    RAISE EXCEPTION 'That schedule activity was not found';
  END IF;
  block := plan_row.blocks -> p_block_index;
  IF block ->> 'location_id' IS NULL OR block ->> 'type' = 'medicine' THEN
    RAISE EXCEPTION 'This activity does not have an NFC place';
  END IF;
  SELECT * INTO place_row FROM checkin_locations
  WHERE id::TEXT = (block ->> 'location_id')
    AND tag_token::TEXT = LOWER(BTRIM(p_tag_token))
    AND EXISTS (
      SELECT 1 FROM patients p WHERE p.id = plan_row.patient_id
        AND (p.created_by = checkin_locations.caregiver_id OR EXISTS (
          SELECT 1 FROM caregiver_patient cp
          WHERE cp.patient_id = p.id AND cp.caregiver_id = checkin_locations.caregiver_id
            AND cp.permission_level IN ('owner', 'editor')
        ))
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This is the wrong sticker for this activity';
  END IF;
  IF EXISTS (SELECT 1 FROM activity_checkins WHERE plan_id = p_plan_id AND block_index = p_block_index) THEN
    RAISE EXCEPTION 'This activity has already been checked in';
  END IF;
  INSERT INTO activity_checkins (patient_id, plan_id, block_index, location_id)
  VALUES (plan_row.patient_id, p_plan_id, p_block_index, place_row.id)
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION check_in_activity(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_in_activity(UUID, INTEGER, TEXT) TO authenticated;
