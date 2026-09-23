CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  trainer_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_client ON public.direct_messages (client_user_id, created_at);
CREATE INDEX idx_dm_trainer ON public.direct_messages (trainer_user_id, created_at);

GRANT SELECT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages" ON public.direct_messages
FOR SELECT TO authenticated
USING (auth.uid() = client_user_id OR (auth.uid() = trainer_user_id AND public.has_role(auth.uid(), 'trainer')));

CREATE OR REPLACE FUNCTION public.mark_direct_messages_read(_client_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.direct_messages SET read_at = now()
  WHERE client_user_id = _client_user_id AND read_at IS NULL
    AND sender_user_id <> auth.uid()
    AND (client_user_id = auth.uid() OR trainer_user_id = auth.uid());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mark_direct_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_direct_messages_read(uuid) TO authenticated;
REVOKE UPDATE ON public.direct_messages FROM authenticated;

ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;