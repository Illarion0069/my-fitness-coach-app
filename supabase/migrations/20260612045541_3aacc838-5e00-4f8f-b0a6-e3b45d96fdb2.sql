
DROP POLICY IF EXISTS "Authenticated users can view blocks" ON public.trainer_blocks;
DROP POLICY IF EXISTS "Anyone authenticated can read working hours" ON public.trainer_working_hours;

CREATE OR REPLACE FUNCTION public.get_trainer_blocked_dates(_trainer uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(blocked_dates, ARRAY[]::text[])
  FROM public.trainer_working_hours
  WHERE trainer_user_id = _trainer
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_trainer_blocked_dates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_blocked_dates(uuid) TO authenticated;
