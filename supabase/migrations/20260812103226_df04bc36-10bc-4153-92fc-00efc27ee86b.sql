CREATE POLICY "Users can insert own measurements"
ON public.body_measurements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
ON public.body_measurements FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements"
ON public.body_measurements FOR DELETE TO authenticated
USING (auth.uid() = user_id);