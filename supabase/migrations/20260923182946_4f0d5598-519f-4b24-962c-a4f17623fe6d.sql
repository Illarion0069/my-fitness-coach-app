CREATE TABLE public.guest_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  guest_name text NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 80),
  trainer_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_chats TO service_role;
ALTER TABLE public.guest_chats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.direct_messages
  ADD COLUMN is_guest boolean NOT NULL DEFAULT false,
  ADD COLUMN trainer_tg_message_id bigint;
CREATE INDEX idx_dm_tg ON public.direct_messages (trainer_tg_message_id) WHERE trainer_tg_message_id IS NOT NULL;