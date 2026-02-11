-- Add telegram username column for client notifications
ALTER TABLE public.group_bookings ADD COLUMN participant_telegram text;

-- Add revolut payment status
ALTER TABLE public.group_bookings ADD COLUMN payment_status text NOT NULL DEFAULT 'pending';
