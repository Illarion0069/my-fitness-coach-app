-- Drop the unique index that prevents two clients at the same time
-- Keep idx_unique_user_session_slot to prevent same user booking same slot twice
DROP INDEX IF EXISTS idx_unique_session_slot;

-- Add a max_clients column to trainer_working_hours for future flexibility
-- (not strictly needed now, we'll hardcode max=2 for split sessions)