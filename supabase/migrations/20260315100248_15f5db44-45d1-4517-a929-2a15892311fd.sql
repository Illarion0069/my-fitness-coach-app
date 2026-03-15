ALTER TABLE public.client_achievements ADD COLUMN celebrated boolean NOT NULL DEFAULT false;

-- Allow users to update their own achievements (to mark celebrated)
CREATE POLICY "Users can update own achievements"
ON public.client_achievements
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);