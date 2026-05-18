CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pra_identifier_time ON public.password_reset_attempts (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pra_ip_time ON public.password_reset_attempts (ip, created_at DESC);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = no access for clients. Service role bypasses RLS.

-- Cleanup helper: function to purge old reset codes and attempts (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_password_reset_data()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.password_reset_codes WHERE created_at < now() - interval '7 days';
  DELETE FROM public.password_reset_attempts WHERE created_at < now() - interval '30 days';
$$;