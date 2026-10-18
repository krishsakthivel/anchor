CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('caregiver', 'patient')),
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pairing_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{8}$'),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pairing_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  succeeded BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date DATE,
  profile_image TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paired_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pair_code TEXT REFERENCES pairing_codes(code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE caregiver_patient (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'owner' CHECK (permission_level IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(caregiver_id, patient_id)
);

CREATE TABLE medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT,
  instructions TEXT,
  photo_url TEXT,
  total_pills INTEGER,
  pills_remaining INTEGER,
  refill_alert_at INTEGER DEFAULT 10,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id, patient_id),
  CHECK (total_pills IS NULL OR total_pills >= 0),
  CHECK (pills_remaining IS NULL OR pills_remaining >= 0),
  CHECK (refill_alert_at IS NULL OR refill_alert_at >= 0),
  CHECK (total_pills IS NULL OR pills_remaining IS NULL OR pills_remaining <= total_pills)
);

CREATE TABLE medication_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  time TIME NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
  active BOOLEAN DEFAULT TRUE,
  UNIQUE (id, patient_id),
  FOREIGN KEY (medication_id, patient_id) REFERENCES medications(id, patient_id) ON DELETE CASCADE
);

CREATE TABLE medication_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES medication_schedule(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('taken', 'missed', 'skipped')),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  log_day DATE NOT NULL DEFAULT CURRENT_DATE,
  FOREIGN KEY (medication_id, patient_id) REFERENCES medications(id, patient_id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id, patient_id) REFERENCES medication_schedule(id, patient_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX medication_log_one_unscheduled_per_day
  ON medication_log (medication_id, log_day)
  WHERE schedule_id IS NULL;

CREATE UNIQUE INDEX medication_log_one_per_schedule_per_day
  ON medication_log (medication_id, schedule_id, log_day)
  WHERE schedule_id IS NOT NULL;

CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  time TIME,
  frequency TEXT DEFAULT 'daily',
  days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id, patient_id)
);

CREATE TABLE task_completion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'skipped', 'missed')),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  completion_day DATE NOT NULL DEFAULT CURRENT_DATE,
  FOREIGN KEY (task_id, patient_id) REFERENCES tasks(id, patient_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX task_completion_one_per_day
  ON task_completion (task_id, completion_day);

CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_time TIMESTAMPTZ NOT NULL,
  repeat_rule TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  priority INTEGER DEFAULT 1
);

CREATE TABLE caregiver_phone (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  phone TEXT NOT NULL
);

CREATE TABLE care_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vital_signs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('blood_pressure', 'blood_sugar', 'weight', 'temperature', 'heart_rate', 'oxygen')),
  value TEXT NOT NULL,
  unit TEXT,
  note TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  doctor TEXT,
  location TEXT,
  appointment_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mood_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  overridden_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, plan_date)
);

CREATE TABLE checkin_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  tag_token UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES daily_plans(id) ON DELETE CASCADE NOT NULL,
  block_index INTEGER NOT NULL CHECK (block_index >= 0),
  location_id UUID REFERENCES checkin_locations(id) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, block_index)
);

CREATE TABLE safety_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('okay', 'needs_help', 'urgent')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_phone ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checkins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_patient_owner(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM patients
    WHERE id = p_patient_id AND created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION has_patient_access(p_patient_id UUID, p_required TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = p_patient_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM caregiver_patient cp
          WHERE cp.patient_id = p.id
            AND cp.caregiver_id = auth.uid()
            AND (
              (p_required = 'viewer' AND cp.permission_level IN ('owner', 'editor', 'viewer'))
              OR (p_required = 'editor' AND cp.permission_level IN ('owner', 'editor'))
              OR (p_required = 'owner' AND cp.permission_level = 'owner')
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION preserve_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change ON profiles;
CREATE TRIGGER prevent_profile_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION preserve_profile_role();

CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Caregivers manage own codes"
  ON pairing_codes FOR ALL
  USING (auth.uid() = caregiver_id AND current_profile_role() = 'caregiver')
  WITH CHECK (auth.uid() = caregiver_id AND current_profile_role() = 'caregiver');

CREATE POLICY "Caregivers can manage own patients"
  ON patients FOR ALL
  USING (auth.uid() = created_by AND current_profile_role() = 'caregiver')
  WITH CHECK (
    auth.uid() = created_by
    AND current_profile_role() = 'caregiver'
    AND (
      pair_code IS NULL
      OR EXISTS (
        SELECT 1 FROM pairing_codes
        WHERE pairing_codes.code = patients.pair_code
          AND pairing_codes.caregiver_id = auth.uid()
      )
    )
  );

CREATE POLICY "Caregivers can view shared patients"
  ON patients FOR SELECT
  USING (has_patient_access(id, 'viewer'));

CREATE POLICY "Patients can read own record"
  ON patients FOR SELECT
  USING (auth.uid() = paired_user_id);

CREATE POLICY "Owners manage caregiver_patient"
  ON caregiver_patient FOR ALL
  USING (is_patient_owner(patient_id))
  WITH CHECK (is_patient_owner(patient_id));

CREATE POLICY "Caregivers read own caregiver_patient links"
  ON caregiver_patient FOR SELECT
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Patients see own caregivers"
  ON caregiver_patient FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible medications"
  ON medications FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own medications"
  ON medications FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible medication schedules"
  ON medication_schedule FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own medication schedules"
  ON medication_schedule FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients log own medications"
  ON medication_log FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
    AND medication_id IN (
      SELECT id FROM medications WHERE medications.patient_id = medication_log.patient_id
    )
  );

CREATE POLICY "Caregivers read patient medication logs"
  ON medication_log FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Caregivers record patient medication logs"
  ON medication_log FOR INSERT
  WITH CHECK (
    has_patient_access(patient_id, 'editor')
    AND EXISTS (SELECT 1 FROM medications WHERE id = medication_id AND medications.patient_id = medication_log.patient_id)
    AND (schedule_id IS NULL OR EXISTS (SELECT 1 FROM medication_schedule WHERE id = schedule_id AND medication_schedule.patient_id = medication_log.patient_id AND medication_schedule.medication_id = medication_log.medication_id))
  );

CREATE POLICY "Patients read own medication logs"
  ON medication_log FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients undo own medication logs"
  ON medication_log FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible tasks"
  ON tasks FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own tasks"
  ON tasks FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients complete own tasks"
  ON task_completion FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
    AND task_id IN (
      SELECT id FROM tasks WHERE tasks.patient_id = task_completion.patient_id
    )
  );

CREATE POLICY "Caregivers read patient task completions"
  ON task_completion FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Patients read own task completions"
  ON task_completion FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients undo own task completions"
  ON task_completion FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible reminders"
  ON reminders FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own reminders"
  ON reminders FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System creates notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Caregivers manage accessible emergency contacts"
  ON emergency_contacts FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own emergency contacts"
  ON emergency_contacts FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients create own safety checkins"
  ON safety_checkins FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE patients.paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients read own safety checkins"
  ON safety_checkins FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE patients.paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers read patient safety checkins"
  ON safety_checkins FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE INDEX safety_checkins_patient_created_at_idx
  ON safety_checkins (patient_id, created_at DESC);

CREATE POLICY "Caregivers manage own phone"
  ON caregiver_phone FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Patients read caregiver phone"
  ON caregiver_phone FOR SELECT
  USING (
    user_id IN (
      SELECT created_by FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible care notes"
  ON care_notes FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own care notes"
  ON care_notes FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients log own vitals"
  ON vital_signs FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers read accessible patient vitals"
  ON vital_signs FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Patients read own vitals"
  ON vital_signs FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage accessible appointments"
  ON appointments FOR ALL
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Patients read own appointments"
  ON appointments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients log own mood"
  ON mood_logs FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers read accessible patient mood"
  ON mood_logs FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Patients read own mood"
  ON mood_logs FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients manage own daily plans"
  ON daily_plans FOR ALL
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers read daily plans"
  ON daily_plans FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Caregivers update daily plans"
  ON daily_plans FOR UPDATE
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));

CREATE POLICY "Caregivers manage own check-in places"
  ON checkin_locations FOR ALL
  USING (caregiver_id = auth.uid() AND current_profile_role() = 'caregiver')
  WITH CHECK (caregiver_id = auth.uid() AND current_profile_role() = 'caregiver');

CREATE POLICY "Patients read own activity check-ins"
  ON activity_checkins FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE paired_user_id = auth.uid()));

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


CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    CASE
      WHEN COALESCE(NEW.is_anonymous, FALSE) THEN 'patient'
      ELSE 'caregiver'
    END,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

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

  IF NOT caller_is_anonymous THEN
    RAISE EXCEPTION 'Only a patient session can claim a pairing code';
  END IF;

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

CREATE OR REPLACE FUNCTION reset_patient_pairing(p_patient_id UUID, p_code TEXT)
RETURNS pairing_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_row patients%ROWTYPE;
  new_code_row pairing_codes%ROWTYPE;
  normalized_code TEXT := UPPER(TRIM(p_code));
BEGIN
  IF auth.uid() IS NULL OR current_profile_role() <> 'caregiver' THEN
    RAISE EXCEPTION 'Caregiver authentication required';
  END IF;

  IF normalized_code IS NULL OR normalized_code !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'Pairing codes must contain eight digits';
  END IF;

  SELECT * INTO patient_row
  FROM patients
  WHERE id = p_patient_id AND created_by = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF EXISTS (SELECT 1 FROM pairing_codes WHERE code = normalized_code) THEN
    RAISE EXCEPTION 'That pairing code already exists';
  END IF;

  UPDATE pairing_codes
  SET used = TRUE
  WHERE code = patient_row.pair_code;

  INSERT INTO pairing_codes (caregiver_id, code)
  VALUES (auth.uid(), normalized_code)
  RETURNING * INTO new_code_row;

  UPDATE patients
  SET paired_user_id = NULL,
      pair_code = normalized_code
  WHERE id = patient_row.id;

  RETURN new_code_row;
END;
$$;


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

CREATE TABLE IF NOT EXISTS caregiver_push_tokens (
  expo_push_token TEXT PRIMARY KEY CHECK (expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE caregiver_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Caregivers manage own push tokens" ON caregiver_push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND current_profile_role() = 'caregiver');

CREATE TABLE IF NOT EXISTS safety_notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES safety_checkins(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL REFERENCES caregiver_push_tokens(expo_push_token) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'accepted', 'delivered', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  ticket_id TEXT,
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checkin_id, expo_push_token)
);
ALTER TABLE safety_notification_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX safety_notification_jobs_pending_idx ON safety_notification_jobs(state, available_at);

CREATE OR REPLACE FUNCTION enqueue_safety_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('needs_help', 'urgent') THEN
    INSERT INTO safety_notification_jobs(checkin_id, expo_push_token)
      SELECT NEW.id, tokens.expo_push_token
      FROM caregiver_push_tokens tokens
      WHERE EXISTS (SELECT 1 FROM patients p WHERE p.id = NEW.patient_id AND (
        p.created_by = tokens.user_id OR EXISTS (
          SELECT 1 FROM caregiver_patient cp WHERE cp.patient_id = p.id
          AND cp.caregiver_id = tokens.user_id AND cp.permission_level IN ('owner', 'editor')
        )
      )) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_safety_notifications AFTER INSERT ON safety_checkins
  FOR EACH ROW EXECUTE FUNCTION enqueue_safety_notifications();

CREATE OR REPLACE FUNCTION claim_safety_notification_jobs(p_checkin_id UUID DEFAULT NULL)
RETURNS SETOF safety_notification_jobs LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE safety_notification_jobs SET state = 'sending', attempts = attempts + 1,
    available_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
  WHERE id IN (
    SELECT id FROM safety_notification_jobs
    WHERE (p_checkin_id IS NULL OR checkin_id = p_checkin_id)
      AND ((state = 'pending' AND available_at <= NOW()) OR (state = 'sending' AND available_at <= NOW()))
      AND attempts < 5
    ORDER BY available_at LIMIT 100 FOR UPDATE SKIP LOCKED
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION claim_safety_notification_jobs(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_safety_notification_jobs(UUID) TO service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'safety_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE safety_checkins;
  END IF;
END $$;

BEGIN;

ALTER TABLE public.medication_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.medication_log TO authenticated;

DROP POLICY IF EXISTS "Caregivers record patient medication logs" ON public.medication_log;
CREATE POLICY "Caregivers record patient medication logs"
  ON public.medication_log FOR INSERT TO authenticated
  WITH CHECK (
    public.has_patient_access(patient_id, 'editor')
    AND EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_log.medication_id AND m.patient_id = medication_log.patient_id
    )
    AND (schedule_id IS NULL OR EXISTS (
      SELECT 1 FROM public.medication_schedule s
      WHERE s.id = medication_log.schedule_id AND s.patient_id = medication_log.patient_id
        AND s.medication_id = medication_log.medication_id
    ))
  );

DROP POLICY IF EXISTS "Patients log own medications" ON public.medication_log;
CREATE POLICY "Patients log own medications"
  ON public.medication_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients p
      WHERE p.id = medication_log.patient_id AND p.paired_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.medications m
      WHERE m.id = medication_log.medication_id AND m.patient_id = medication_log.patient_id)
    AND (schedule_id IS NULL OR EXISTS (
      SELECT 1 FROM public.medication_schedule s
      WHERE s.id = medication_log.schedule_id AND s.patient_id = medication_log.patient_id
        AND s.medication_id = medication_log.medication_id
    ))
  );

DROP POLICY IF EXISTS "Caregivers read patient medication logs" ON public.medication_log;
CREATE POLICY "Caregivers read patient medication logs"
  ON public.medication_log FOR SELECT TO authenticated
  USING (public.has_patient_access(patient_id, 'viewer'));

DROP POLICY IF EXISTS "Patients read own medication logs" ON public.medication_log;
CREATE POLICY "Patients read own medication logs"
  ON public.medication_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p
    WHERE p.id = medication_log.patient_id AND p.paired_user_id = auth.uid()));

COMMIT;



BEGIN;

ALTER TABLE public.medication_schedule ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE public.medication_schedule s SET created_at = m.created_at
  FROM public.medications m WHERE s.medication_id = m.id AND s.created_at IS NULL;
ALTER TABLE public.medication_schedule ALTER COLUMN created_at SET DEFAULT NOW();


COMMIT;

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

BEGIN;

ALTER TABLE public.medication_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.medication_log TO authenticated;

DROP POLICY IF EXISTS "Caregivers record patient medication logs" ON public.medication_log;
CREATE POLICY "Caregivers record patient medication logs"
  ON public.medication_log FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.patients p
        WHERE p.id = medication_log.patient_id AND p.created_by = auth.uid())
      OR public.has_patient_access(patient_id, 'editor')
    )
    AND EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_log.medication_id AND m.patient_id = medication_log.patient_id
    )
    AND (schedule_id IS NULL OR EXISTS (
      SELECT 1 FROM public.medication_schedule s
      WHERE s.id = medication_log.schedule_id AND s.patient_id = medication_log.patient_id
        AND s.medication_id = medication_log.medication_id
    ))
  );

DROP POLICY IF EXISTS "Patients log own medications" ON public.medication_log;
CREATE POLICY "Patients log own medications"
  ON public.medication_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients p
      WHERE p.id = medication_log.patient_id AND p.paired_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.medications m
      WHERE m.id = medication_log.medication_id AND m.patient_id = medication_log.patient_id)
    AND (schedule_id IS NULL OR EXISTS (
      SELECT 1 FROM public.medication_schedule s
      WHERE s.id = medication_log.schedule_id AND s.patient_id = medication_log.patient_id
        AND s.medication_id = medication_log.medication_id
    ))
  );

DROP POLICY IF EXISTS "Caregivers read patient medication logs" ON public.medication_log;
CREATE POLICY "Caregivers read patient medication logs"
  ON public.medication_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.patients p
      WHERE p.id = medication_log.patient_id AND p.created_by = auth.uid())
    OR public.has_patient_access(patient_id, 'viewer')
  );

DROP POLICY IF EXISTS "Patients read own medication logs" ON public.medication_log;
CREATE POLICY "Patients read own medication logs"
  ON public.medication_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p
    WHERE p.id = medication_log.patient_id AND p.paired_user_id = auth.uid()));

COMMIT;

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
BEGIN;
ALTER TABLE public.medication_log ADD COLUMN IF NOT EXISTS pill_deducted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.update_medication_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.pill_deducted := FALSE;
    IF NEW.status = 'taken' THEN
      UPDATE public.medications SET pills_remaining = pills_remaining - 1
        WHERE id = NEW.medication_id AND patient_id = NEW.patient_id AND pills_remaining > 0;
      NEW.pill_deducted := FOUND;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.pill_deducted THEN
    UPDATE public.medications
      SET pills_remaining = CASE WHEN pills_remaining < COALESCE(total_pills, 2147483647)
        THEN pills_remaining + 1 ELSE pills_remaining END
      WHERE id = OLD.medication_id AND patient_id = OLD.patient_id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.update_medication_stock() FROM PUBLIC;
DROP TRIGGER IF EXISTS medication_log_stock ON public.medication_log;
CREATE TRIGGER medication_log_stock BEFORE INSERT OR DELETE ON public.medication_log
  FOR EACH ROW EXECUTE FUNCTION public.update_medication_stock();
COMMIT;

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
