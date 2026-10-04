CREATE TABLE safety_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('okay', 'needs_help', 'urgent')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE safety_checkins ENABLE ROW LEVEL SECURITY;

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