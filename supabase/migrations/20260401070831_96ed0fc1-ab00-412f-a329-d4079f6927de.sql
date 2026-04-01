-- Fix Rodion's balance: refund the incorrectly deducted March 23 session
-- Insert refund ledger entry
INSERT INTO public.session_ledger (user_id, package_id, delta, reason, session_id, used_before, used_after, idempotency_key)
VALUES (
  '562cc346-a60d-4fb9-aa02-1255af780e71',
  '126b9cff-5fc9-4017-98f8-04bbbb24aad0',
  -1,
  'refund_cancelled',
  '65874fff-e8cb-4a80-90dc-9d9297156b8b',
  6,
  5,
  'refund_cron_user_562cc346-a60d-4fb9-aa02-1255af780e71_2026-03-23'
);

-- Update package used_sessions from 6 to 5
UPDATE public.client_packages
SET used_sessions = 5
WHERE id = '126b9cff-5fc9-4017-98f8-04bbbb24aad0'
  AND used_sessions = 6;

-- Add unique index on idempotency_key to prevent duplicate deductions
CREATE UNIQUE INDEX IF NOT EXISTS ux_session_ledger_idempotency
ON public.session_ledger (idempotency_key)
WHERE idempotency_key IS NOT NULL;