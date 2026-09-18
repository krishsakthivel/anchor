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

-- Failed code attempts are written only by the SECURITY DEFINER claim
-- function. There are intentionally no client-facing policies on this table.
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

-- Centralized access checks keep every child table tied to the same patient
-- ownership/sharing rules. SECURITY DEFINER lets these helpers inspect the
-- ownership rows without being blocked by the caller's RLS policies.
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
              p_required = 'viewer'
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

-- Patients pair through this function instead of reading pairing_codes directly.
-- SECURITY DEFINER is required because the anonymous patient session cannot update
-- the caregiver-owned patients/pairing_codes rows under normal RLS policies.
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

-- Lets the owning caregiver issue a fresh code when a patient signs out,
-- reinstalls the app, or moves to a new phone. The old pairing is revoked in
-- the same transaction so two patient sessions cannot remain active.
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
