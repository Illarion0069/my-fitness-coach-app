-- Prevent race condition: unique constraint on one-off sessions per slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_session_slot 
ON public.scheduled_sessions (session_date, session_time) 
WHERE is_recurring = false AND session_time IS NOT NULL;

-- Prevent same client booking same slot twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_session_slot
ON public.scheduled_sessions (user_id, session_date, session_time)
WHERE is_recurring = false AND session_time IS NOT NULL;