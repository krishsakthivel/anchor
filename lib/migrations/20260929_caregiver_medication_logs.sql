DROP POLICY IF EXISTS "Caregivers record patient medication logs" ON medication_log;
CREATE POLICY "Caregivers record patient medication logs"
  ON medication_log FOR INSERT
  WITH CHECK (
    has_patient_access(patient_id, 'editor')
    AND EXISTS (SELECT 1 FROM medications WHERE id = medication_id AND medications.patient_id = medication_log.patient_id)
    AND (schedule_id IS NULL OR EXISTS (SELECT 1 FROM medication_schedule WHERE id = schedule_id AND medication_schedule.patient_id = medication_log.patient_id AND medication_schedule.medication_id = medication_log.medication_id))
  );
