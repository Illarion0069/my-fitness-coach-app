-- Add telegram_chat_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Allow trainers to view telegram_chat_id (already covered by existing SELECT policy)
