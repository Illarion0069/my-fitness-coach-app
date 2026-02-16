
-- Table for trainer calendar blocks (blocked hours, travel time, personal events)
CREATE TABLE public.trainer_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_user_id UUID NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'block', -- 'block', 'travel', 'personal'
  title TEXT, -- e.g. "Reload", "Group class", custom name
  block_date DATE, -- NULL for recurring
  block_time TIME NOT NULL, -- start time
  duration_minutes SMALLINT NOT NULL DEFAULT 60,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_day SMALLINT, -- 0=Sun..6=Sat, for recurring blocks
  linked_session_id UUID REFERENCES public.scheduled_sessions(id) ON DELETE CASCADE, -- for travel time linked to a session
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own blocks"
  ON public.trainer_blocks FOR ALL
  USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id)
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Authenticated users can view blocks"
  ON public.trainer_blocks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_trainer_blocks_updated_at
  BEFORE UPDATE ON public.trainer_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
