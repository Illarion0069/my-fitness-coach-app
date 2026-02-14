CREATE POLICY "Users can delete own future sessions"
ON public.scheduled_sessions
FOR DELETE
USING (auth.uid() = user_id AND is_deducted = false);