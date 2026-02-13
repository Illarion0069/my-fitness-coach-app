
-- Add telegram_link_code to profiles
ALTER TABLE public.profiles ADD COLUMN telegram_link_code TEXT UNIQUE;

-- Generate codes for existing profiles that don't have one
UPDATE public.profiles 
SET telegram_link_code = substr(md5(random()::text || id::text), 1, 12)
WHERE telegram_link_code IS NULL;
