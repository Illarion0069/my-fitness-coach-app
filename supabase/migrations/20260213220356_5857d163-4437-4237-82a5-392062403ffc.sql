
-- Drop the overly permissive policy
DROP POLICY "Service role can manage metrics" ON public.whoop_metrics;

-- Allow users to insert/update their own metrics (used by edge function with service role key, but also safe for direct access)
CREATE POLICY "Users can insert own metrics"
  ON public.whoop_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
  ON public.whoop_metrics FOR UPDATE
  USING (auth.uid() = user_id);
