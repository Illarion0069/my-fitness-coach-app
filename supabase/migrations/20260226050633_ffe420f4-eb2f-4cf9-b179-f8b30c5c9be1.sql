-- Ledger table: every +/- change to a package balance is recorded here
CREATE TABLE public.session_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid NOT NULL,
  delta integer NOT NULL,  -- +1 = deduction, -1 = refund
  reason text NOT NULL,    -- 'cron_deduct', 'manual_add', 'client_book', 'trainer_cancel', 'client_cancel', 'correction'
  session_id uuid,         -- optional link to scheduled_sessions.id
  used_before integer NOT NULL,
  used_after integer NOT NULL,
  idempotency_key text,    -- prevents duplicate entries
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index for idempotency — same session+reason can only be recorded once
CREATE UNIQUE INDEX idx_ledger_idempotency ON public.session_ledger (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for lookups
CREATE INDEX idx_ledger_user_id ON public.session_ledger (user_id);
CREATE INDEX idx_ledger_package_id ON public.session_ledger (package_id);

-- RLS
ALTER TABLE public.session_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view all ledger entries"
  ON public.session_ledger FOR SELECT
  USING (public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Users can view own ledger entries"
  ON public.session_ledger FOR SELECT
  USING (auth.uid() = user_id);