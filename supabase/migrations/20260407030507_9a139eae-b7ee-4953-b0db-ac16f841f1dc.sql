
-- Fix Irina's package: set used_sessions to correct value of 5 (out of 8, so 3 remaining)
UPDATE public.client_packages 
SET used_sessions = 5, updated_at = now()
WHERE id = '24e33868-426c-4712-8915-f3c17eb5c02d';
