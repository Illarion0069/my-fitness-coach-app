-- Remove trainer access to OAuth tokens - trainers should only access whoop_metrics, not raw tokens
DROP POLICY IF EXISTS "Trainers can view all whoop tokens" ON public.whoop_tokens;