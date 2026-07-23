
-- Prevent duplicate guest bookings at DB level.
-- Applies only to guest self-bookings (guest_bookings table).
-- Trainer-created sessions live in scheduled_sessions and remain unaffected —
-- trainers can still create/move sessions to any time as needed.

-- 1) Only one active guest booking per trainer/date/time slot.
CREATE UNIQUE INDEX IF NOT EXISTS guest_bookings_unique_slot
  ON public.guest_bookings (trainer_user_id, session_date, session_time)
  WHERE status IN ('pending', 'confirmed');

-- 2) Same phone cannot double-book the same slot.
CREATE UNIQUE INDEX IF NOT EXISTS guest_bookings_unique_phone_slot
  ON public.guest_bookings (guest_phone, session_date, session_time)
  WHERE status IN ('pending', 'confirmed');
