
-- Store Whoop OAuth tokens per user
CREATE TABLE public.whoop_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whoop_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whoop tokens"
  ON public.whoop_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whoop tokens"
  ON public.whoop_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whoop tokens"
  ON public.whoop_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whoop tokens"
  ON public.whoop_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view all whoop tokens"
  ON public.whoop_tokens FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE TRIGGER update_whoop_tokens_updated_at
  BEFORE UPDATE ON public.whoop_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Store Whoop workout/fitness metrics
CREATE TABLE public.whoop_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  calories NUMERIC,
  avg_heart_rate NUMERIC,
  max_heart_rate NUMERIC,
  strain NUMERIC,
  recovery_score NUMERIC,
  hrv NUMERIC,
  resting_heart_rate NUMERIC,
  sleep_duration_minutes NUMERIC,
  workout_count INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

ALTER TABLE public.whoop_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON public.whoop_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view all metrics"
  ON public.whoop_metrics FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Service role can manage metrics"
  ON public.whoop_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_whoop_metrics_updated_at
  BEFORE UPDATE ON public.whoop_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_whoop_metrics_user_date ON public.whoop_metrics(user_id, metric_date DESC);
