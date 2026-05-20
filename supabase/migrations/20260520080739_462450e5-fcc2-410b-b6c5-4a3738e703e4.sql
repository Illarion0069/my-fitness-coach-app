ALTER TABLE public.test_results
ADD COLUMN IF NOT EXISTS test_type text NOT NULL DEFAULT 'baseline';

CREATE INDEX IF NOT EXISTS idx_test_results_user_type ON public.test_results(user_id, test_type, created_at DESC);