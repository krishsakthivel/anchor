-- Explicitly recognize the care-plan creator, including on projects with an
-- older access helper or without an owner row in caregiver_patient.
-- Viewer/family users still cannot record medication outcomes.
-- Run in the Supabase SQL Editor for the same project used by Anchor.
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

-- The patient flow requests the inserted row back; it needs a SELECT policy too.
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
