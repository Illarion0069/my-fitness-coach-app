ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text NULL,
  ADD COLUMN IF NOT EXISTS reactivation_sent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_archived_at ON public.profiles (archived_at);