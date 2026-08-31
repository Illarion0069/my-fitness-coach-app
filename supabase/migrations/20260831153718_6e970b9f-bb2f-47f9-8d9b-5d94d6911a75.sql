-- 1. Canonical tenant key on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trainer_user_id uuid;

-- backfill from existing sessions, then fall back to the sole trainer
UPDATE public.profiles p
SET trainer_user_id = s.trainer_user_id
FROM (SELECT DISTINCT ON (user_id) user_id, trainer_user_id FROM public.scheduled_sessions WHERE trainer_user_id IS NOT NULL ORDER BY user_id, created_at DESC) s
WHERE p.user_id = s.user_id AND p.trainer_user_id IS NULL;

UPDATE public.profiles
SET trainer_user_id = (SELECT user_id FROM public.user_roles WHERE role = 'trainer' ORDER BY id LIMIT 1)
WHERE trainer_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_trainer_user_id ON public.profiles(trainer_user_id);

-- new profiles inherit the default trainer so nobody becomes invisible in the admin panel
CREATE OR REPLACE FUNCTION public.set_default_trainer_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trainer_user_id IS NULL THEN
    NEW.trainer_user_id := (SELECT user_id FROM public.user_roles WHERE role = 'trainer' ORDER BY id LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_trainer_on_profile ON public.profiles;
CREATE TRIGGER trg_set_default_trainer_on_profile
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_default_trainer_on_profile();

-- 2. Ownership helper (security definer avoids recursive RLS on profiles)
CREATE OR REPLACE FUNCTION public.is_my_client(_client_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'trainer'::app_role)
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE user_id = _client_user_id
         AND trainer_user_id = auth.uid()
     );
$$;

GRANT EXECUTE ON FUNCTION public.is_my_client(uuid) TO authenticated;

-- 3. profiles
DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can delete profiles" ON public.profiles;

CREATE POLICY "Trainers can view own clients profiles" ON public.profiles
FOR SELECT TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can update own clients profiles" ON public.profiles
FOR UPDATE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role))
WITH CHECK (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can delete own clients profiles" ON public.profiles
FOR DELETE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));

-- 4. body_measurements
DROP POLICY IF EXISTS "Trainers can view all measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "Trainers can insert measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "Trainers can update measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "Trainers can delete measurements" ON public.body_measurements;

CREATE POLICY "Trainers can view own clients measurements" ON public.body_measurements
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can insert own clients measurements" ON public.body_measurements
FOR INSERT TO authenticated WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can update own clients measurements" ON public.body_measurements
FOR UPDATE TO authenticated USING (public.is_my_client(user_id)) WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can delete own clients measurements" ON public.body_measurements
FOR DELETE TO authenticated USING (public.is_my_client(user_id));

-- 5. client_packages
DROP POLICY IF EXISTS "Trainers can view all packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can insert packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can update packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can delete packages" ON public.client_packages;

CREATE POLICY "Trainers can view own clients packages" ON public.client_packages
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can insert own clients packages" ON public.client_packages
FOR INSERT TO authenticated WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can update own clients packages" ON public.client_packages
FOR UPDATE TO authenticated USING (public.is_my_client(user_id)) WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can delete own clients packages" ON public.client_packages
FOR DELETE TO authenticated USING (public.is_my_client(user_id));

-- 6. nutrition_logs
DROP POLICY IF EXISTS "Trainers can view all nutrition logs" ON public.nutrition_logs;
DROP POLICY IF EXISTS "Trainers can update nutrition logs" ON public.nutrition_logs;

CREATE POLICY "Trainers can view own clients nutrition logs" ON public.nutrition_logs
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can update own clients nutrition logs" ON public.nutrition_logs
FOR UPDATE TO authenticated USING (public.is_my_client(user_id)) WITH CHECK (public.is_my_client(user_id));

-- 7. test_results
DROP POLICY IF EXISTS "Trainers can view all test results" ON public.test_results;
CREATE POLICY "Trainers can view own clients test results" ON public.test_results
FOR SELECT TO authenticated USING (public.is_my_client(user_id));

-- 8. whoop_metrics
DROP POLICY IF EXISTS "Trainers can view all metrics" ON public.whoop_metrics;
CREATE POLICY "Trainers can view own clients metrics" ON public.whoop_metrics
FOR SELECT TO authenticated USING (public.is_my_client(user_id));

-- 9. scheduled_sessions (owns trainer_user_id directly)
DROP POLICY IF EXISTS "Trainers can view all sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Trainers can insert sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Trainers can update sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Trainers can delete sessions" ON public.scheduled_sessions;

CREATE POLICY "Trainers can view own sessions" ON public.scheduled_sessions
FOR SELECT TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can insert own sessions" ON public.scheduled_sessions
FOR INSERT TO authenticated WITH CHECK (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can update own sessions" ON public.scheduled_sessions
FOR UPDATE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role))
WITH CHECK (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can delete own sessions" ON public.scheduled_sessions
FOR DELETE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));

-- 10. guest_bookings
DROP POLICY IF EXISTS "Trainers can view guest bookings" ON public.guest_bookings;
DROP POLICY IF EXISTS "Trainers can update guest bookings" ON public.guest_bookings;
DROP POLICY IF EXISTS "Trainers can delete guest bookings" ON public.guest_bookings;

CREATE POLICY "Trainers can view own guest bookings" ON public.guest_bookings
FOR SELECT TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can update own guest bookings" ON public.guest_bookings
FOR UPDATE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role))
WITH CHECK (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));
CREATE POLICY "Trainers can delete own guest bookings" ON public.guest_bookings
FOR DELETE TO authenticated USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));