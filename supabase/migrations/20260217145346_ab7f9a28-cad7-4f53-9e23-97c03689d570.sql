
-- Unique partial index on phone (exclude empty strings and Google-only profiles without phone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_phone 
ON public.profiles (phone) 
WHERE phone != '' AND phone != 'not_set';
