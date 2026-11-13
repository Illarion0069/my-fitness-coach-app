CREATE TABLE public.calendar_feed_tokens (
  trainer_user_id uuid PRIMARY KEY,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.calendar_feed_tokens TO authenticated;
GRANT ALL ON public.calendar_feed_tokens TO service_role;
CREATE POLICY "Trainer reads own feed token" ON public.calendar_feed_tokens FOR SELECT TO authenticated
  USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));
CREATE POLICY "Trainer creates own feed token" ON public.calendar_feed_tokens FOR INSERT TO authenticated
  WITH CHECK (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));
CREATE POLICY "Trainer deletes own feed token" ON public.calendar_feed_tokens FOR DELETE TO authenticated
  USING (trainer_user_id = auth.uid());