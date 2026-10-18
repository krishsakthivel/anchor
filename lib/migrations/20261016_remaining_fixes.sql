BEGIN;

ALTER TABLE public.medication_schedule ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE public.medication_schedule s SET created_at = m.created_at
  FROM public.medications m WHERE s.medication_id = m.id AND s.created_at IS NULL;
ALTER TABLE public.medication_schedule ALTER COLUMN created_at SET DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.family_status()
RETURNS TABLE (patient_id UUID, patient_name TEXT, medication_status TEXT, care_status TEXT)
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH family_patients AS (
    SELECT p.id, p.name FROM patients p JOIN caregiver_patient cp ON cp.patient_id = p.id
    WHERE cp.caregiver_id = auth.uid() AND cp.permission_level = 'family'
  ), today_logs AS (
    SELECT ml.patient_id,
      COUNT(*) FILTER (WHERE ml.status = 'taken') AS taken,
      COUNT(*) FILTER (WHERE ml.status = 'missed') AS missed
    FROM medication_log ml WHERE ml.log_day = CURRENT_DATE GROUP BY ml.patient_id
  ), today_moods AS (
    SELECT DISTINCT ON (patient_id) patient_id, mood FROM mood_logs
    WHERE logged_at >= date_trunc('day', NOW()) ORDER BY patient_id, logged_at DESC
  )
  SELECT fp.id, fp.name,
    CASE WHEN COALESCE(tl.missed, 0) > 0 THEN 'Medication missed'
      WHEN COALESCE(tl.taken, 0) > 0 THEN 'Medication checked'
      ELSE 'No medication update yet' END,
    CASE WHEN tm.mood IS NULL THEN 'No mood update yet'
      WHEN tm.mood <= 2 THEN 'Needs extra care' ELSE 'Doing okay' END
  FROM family_patients fp LEFT JOIN today_logs tl ON tl.patient_id = fp.id
    LEFT JOIN today_moods tm ON tm.patient_id = fp.id;
$$;
REVOKE ALL ON FUNCTION public.family_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_status() TO authenticated;

COMMIT;
