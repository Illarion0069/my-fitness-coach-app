
ALTER TABLE public.scheduled_sessions
ADD COLUMN recurring_exceptions date[] NOT NULL DEFAULT '{}';
