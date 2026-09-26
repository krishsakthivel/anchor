ALTER TABLE caregiver_patient DROP CONSTRAINT IF EXISTS caregiver_patient_permission_level_check;
ALTER TABLE caregiver_patient ADD CONSTRAINT caregiver_patient_permission_level_check CHECK (permission_level IN ('owner', 'editor', 'viewer', 'family'));

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

CREATE OR REPLACE FUNCTION family_status()
RETURNS TABLE (patient_id UUID, patient_name TEXT, medication_status TEXT, care_status TEXT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH family_patients AS (
    SELECT p.id, p.name
    FROM patients p
    JOIN caregiver_patient cp ON cp.patient_id = p.id
    WHERE cp.caregiver_id = auth.uid() AND cp.permission_level = 'family'
  ), today_logs AS (
    SELECT ml.patient_id,
      COUNT(*) FILTER (WHERE ml.status = 'taken') AS taken,
      COUNT(*) FILTER (WHERE ml.status = 'missed') AS missed
    FROM medication_log ml
    WHERE ml.log_day = CURRENT_DATE
    GROUP BY ml.patient_id
  ), today_moods AS (
    SELECT DISTINCT ON (patient_id) patient_id, mood
    FROM mood_logs
    WHERE logged_at >= date_trunc('day', NOW())
    ORDER BY patient_id, logged_at DESC
  )
  SELECT fp.id,
    fp.name,
    CASE
      WHEN COALESCE(tl.missed, 0) > 0 THEN 'Medication missed'
      WHEN COALESCE(tl.taken, 0) > 0 THEN 'Medication checked'
      ELSE 'No medication update yet'
    END,
    CASE WHEN tm.mood <= 2 THEN 'Needs extra care' ELSE 'Doing okay' END
  FROM family_patients fp
  LEFT JOIN today_logs tl ON tl.patient_id = fp.id
  LEFT JOIN today_moods tm ON tm.patient_id = fp.id;
$$;

REVOKE ALL ON FUNCTION family_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION family_status() TO authenticated;
