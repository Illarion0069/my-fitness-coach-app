
-- Fix 1: Restrict group_bookings SELECT to trainers only (was publicly readable with PII)
DROP POLICY "Anyone can view bookings" ON public.group_bookings;

CREATE POLICY "Trainers can view bookings"
  ON public.group_bookings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));
