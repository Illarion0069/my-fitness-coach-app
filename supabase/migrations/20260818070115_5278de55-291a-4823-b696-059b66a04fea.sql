ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS report_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_report_pending
  ON public.nutrition_logs (report_marked_at)
  WHERE report_pending;