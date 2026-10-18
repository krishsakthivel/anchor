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
