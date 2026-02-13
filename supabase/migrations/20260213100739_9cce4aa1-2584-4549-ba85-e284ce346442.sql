
-- Remove group training tables entirely
DROP POLICY IF EXISTS "Trainers can view bookings" ON public.group_bookings;
DROP POLICY IF EXISTS "Anyone can book a spot" ON public.group_bookings;
DROP TABLE IF EXISTS public.group_bookings;

DROP POLICY IF EXISTS "Anyone can view active sessions" ON public.group_sessions;
DROP TABLE IF EXISTS public.group_sessions;
