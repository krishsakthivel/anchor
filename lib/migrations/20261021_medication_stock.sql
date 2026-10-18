BEGIN;
ALTER TABLE public.medication_log ADD COLUMN IF NOT EXISTS pill_deducted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.update_medication_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.pill_deducted := FALSE;
    IF NEW.status = 'taken' THEN
      UPDATE public.medications SET pills_remaining = pills_remaining - 1
        WHERE id = NEW.medication_id AND patient_id = NEW.patient_id AND pills_remaining > 0;
      NEW.pill_deducted := FOUND;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.pill_deducted THEN
    UPDATE public.medications
      SET pills_remaining = CASE WHEN pills_remaining < COALESCE(total_pills, 2147483647)
        THEN pills_remaining + 1 ELSE pills_remaining END
      WHERE id = OLD.medication_id AND patient_id = OLD.patient_id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.update_medication_stock() FROM PUBLIC;
DROP TRIGGER IF EXISTS medication_log_stock ON public.medication_log;
CREATE TRIGGER medication_log_stock BEFORE INSERT OR DELETE ON public.medication_log
  FOR EACH ROW EXECUTE FUNCTION public.update_medication_stock();
COMMIT;
