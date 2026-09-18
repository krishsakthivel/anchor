-- Apply this migration to existing Supabase projects so patients can undo a
-- medication or task check-in that they just recorded.

DROP POLICY IF EXISTS "Patients undo own medication logs" ON medication_log;
CREATE POLICY "Patients undo own medication logs"
  ON medication_log FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients undo own task completions" ON task_completion;
CREATE POLICY "Patients undo own task completions"
  ON task_completion FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE paired_user_id = auth.uid()
    )
  );
