
-- Table for scheduled training sessions
CREATE TABLE public.scheduled_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trainer_user_id uuid NOT NULL,
  session_date date NOT NULL,
  session_time time,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_day smallint, -- 0=Sun, 1=Mon, ..., 6=Sat
  recurrence_time time,
  is_deducted boolean NOT NULL DEFAULT false,
  deducted_at timestamp with time zone,
  package_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- Trainers can do everything
CREATE POLICY "Trainers can view all sessions"
  ON public.scheduled_sessions FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can insert sessions"
  ON public.scheduled_sessions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update sessions"
  ON public.scheduled_sessions FOR UPDATE
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can delete sessions"
  ON public.scheduled_sessions FOR DELETE
  USING (has_role(auth.uid(), 'trainer'::app_role));

-- Clients can view own sessions
CREATE POLICY "Users can view own sessions"
  ON public.scheduled_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Index for cron job lookups
CREATE INDEX idx_scheduled_sessions_date ON public.scheduled_sessions (session_date, is_deducted);
CREATE INDEX idx_scheduled_sessions_recurring ON public.scheduled_sessions (is_recurring, recurrence_day) WHERE is_recurring = true;

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_sessions_updated_at
  BEFORE UPDATE ON public.scheduled_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
