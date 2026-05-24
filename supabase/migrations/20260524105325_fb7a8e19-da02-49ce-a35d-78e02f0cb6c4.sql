
-- 1) Remove client self-insert on achievements (achievements are awarded by service-role only via edge functions)
DROP POLICY IF EXISTS "Authenticated can insert own achievements" ON public.client_achievements;

-- 2) Fix pending_notifications policies: scope to trainer only, no broad service-role mislabel
DROP POLICY IF EXISTS "Service role full access" ON public.pending_notifications;

CREATE POLICY "Trainers can view own pending notifications"
ON public.pending_notifications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can update own pending notifications"
ON public.pending_notifications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id)
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can delete own pending notifications"
ON public.pending_notifications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);
