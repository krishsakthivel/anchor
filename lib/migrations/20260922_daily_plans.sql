CREATE TABLE IF NOT EXISTS daily_plans (
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

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own daily plans"
  ON daily_plans FOR ALL
  USING (patient_id IN (SELECT id FROM patients WHERE paired_user_id = auth.uid()))
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE paired_user_id = auth.uid()));

CREATE POLICY "Caregivers read daily plans"
  ON daily_plans FOR SELECT
  USING (has_patient_access(patient_id, 'viewer'));

CREATE POLICY "Caregivers update daily plans"
  ON daily_plans FOR UPDATE
  USING (has_patient_access(patient_id, 'editor'))
  WITH CHECK (has_patient_access(patient_id, 'editor'));
