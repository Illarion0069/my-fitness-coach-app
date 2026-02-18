
-- Table for temporary password reset codes (sent via Telegram)
CREATE TABLE public.password_reset_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access - only edge functions with service_role will use this table
-- Auto-cleanup: old codes
CREATE INDEX idx_reset_codes_phone ON public.password_reset_codes (phone, used, expires_at);
