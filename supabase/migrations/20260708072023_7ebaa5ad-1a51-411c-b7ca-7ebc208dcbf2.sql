CREATE OR REPLACE FUNCTION public.apply_previous_package_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_id uuid;
  prev_used integer;
  prev_total integer;
  debt integer;
BEGIN
  SELECT id, used_sessions, total_sessions
    INTO prev_id, prev_used, prev_total
  FROM public.client_packages
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF prev_id IS NOT NULL THEN
    debt := COALESCE(prev_used, 0) - COALESCE(prev_total, 0);
    IF debt > 0 THEN
      NEW.used_sessions := COALESCE(NEW.used_sessions, 0) + debt;
      UPDATE public.client_packages
        SET used_sessions = total_sessions
      WHERE id = prev_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_debt_on_new_package ON public.client_packages;
CREATE TRIGGER apply_debt_on_new_package
BEFORE INSERT ON public.client_packages
FOR EACH ROW EXECUTE FUNCTION public.apply_previous_package_debt();