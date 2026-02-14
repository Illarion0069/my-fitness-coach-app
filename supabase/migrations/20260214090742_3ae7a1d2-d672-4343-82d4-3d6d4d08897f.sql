ALTER TABLE public.scheduled_sessions 
ADD COLUMN duration_minutes smallint NOT NULL DEFAULT 60;