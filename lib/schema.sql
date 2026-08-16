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
  code TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date DATE,
  profile_image TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paired_user_id UUID REFERENCES auth.users(id),
  pair_code TEXT REFERENCES pairing_codes(code),
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medication_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  time TIME NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE medication_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES medication_schedule(id),
  status TEXT NOT NULL CHECK (status IN ('taken', 'missed', 'skipped')),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_completion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'skipped', 'missed')),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "Caregivers manage own codes"
  ON pairing_codes FOR ALL
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Anyone can read pairing codes"
  ON pairing_codes FOR SELECT
  USING (true);

CREATE POLICY "Caregivers manage own patients"
  ON patients FOR ALL
  USING (auth.uid() = created_by);

CREATE POLICY "Patients can read own record"
  ON patients FOR SELECT
  USING (auth.uid() = paired_user_id);

CREATE POLICY "Caregivers manage caregiver_patient"
  ON caregiver_patient FOR ALL
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Patients see own caregivers"
  ON caregiver_patient FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage own medications"
  ON medications FOR ALL
  USING (auth.uid() = created_by);

CREATE POLICY "Patients read own medications"
  ON medications FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage own medication schedules"
  ON medication_schedule FOR ALL
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

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
  );

CREATE POLICY "Caregivers read patient medication logs"
  ON medication_log FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Patients read own medication logs"
  ON medication_log FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = created_by);

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
  );

CREATE POLICY "Caregivers read patient task completions"
  ON task_completion FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Patients read own task completions"
  ON task_completion FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage own reminders"
  ON reminders FOR ALL
  USING (auth.uid() = created_by);

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
  WITH CHECK (true);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Caregivers manage patient emergency contacts"
  ON emergency_contacts FOR ALL
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

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

CREATE POLICY "Caregivers manage care notes"
  ON care_notes FOR ALL
  USING (auth.uid() = created_by);

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

CREATE POLICY "Caregivers read patient vitals"
  ON vital_signs FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Patients read own vitals"
  ON vital_signs FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers manage appointments"
  ON appointments FOR ALL
  USING (auth.uid() = created_by);

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

CREATE POLICY "Caregivers read patient mood"
  ON mood_logs FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE created_by = auth.uid()
    )
  );

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
    COALESCE(NEW.raw_user_meta_data->>'role', 'caregiver'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
