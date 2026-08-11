CREATE TABLE public.app_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  anon_id text NOT NULL,
  event_type text NOT NULL,
  label text NOT NULL,
  path text,
  device text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_events_created_at ON public.app_events (created_at DESC);
CREATE INDEX idx_app_events_user ON public.app_events (user_id, created_at DESC);

GRANT INSERT ON public.app_events TO anon, authenticated;
GRANT SELECT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log events"
ON public.app_events FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Trainers and admins can read events"
ON public.app_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'trainer') OR public.has_role(auth.uid(), 'admin'));