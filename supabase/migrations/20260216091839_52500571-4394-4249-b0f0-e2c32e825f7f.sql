
-- Table to queue notification events for batching
CREATE TABLE public.pending_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL,
  trainer_user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'session_added', 'session_deleted'
  details TEXT NOT NULL, -- human-readable line for the consolidated message
  created_at TIMESTAMPTZ DEFAULT now(),
  is_sent BOOLEAN DEFAULT false
);

-- Index for efficient cron queries
CREATE INDEX idx_pending_notifications_unsent 
  ON public.pending_notifications (client_user_id, is_sent, created_at) 
  WHERE is_sent = false;

-- RLS
ALTER TABLE public.pending_notifications ENABLE ROW LEVEL SECURITY;

-- Trainers can insert
CREATE POLICY "Trainers can insert notifications"
  ON public.pending_notifications FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'trainer'));

-- Service role handles reads/updates via edge function
CREATE POLICY "Service role full access"
  ON public.pending_notifications FOR ALL
  USING (auth.uid() = trainer_user_id);
