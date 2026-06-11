ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.pending_notifications ADD COLUMN IF NOT EXISTS details_en text;
ALTER TABLE public.pending_notifications ADD COLUMN IF NOT EXISTS details_ru text;