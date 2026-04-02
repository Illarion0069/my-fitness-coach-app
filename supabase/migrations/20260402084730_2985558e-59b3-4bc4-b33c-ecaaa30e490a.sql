
CREATE TABLE public.guest_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  session_date date NOT NULL,
  session_time time without time zone,
  status text NOT NULL DEFAULT 'pending',
  trainer_user_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (guest booking without auth)
CREATE POLICY "Anyone can create guest bookings"
ON public.guest_bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Trainers can view all guest bookings
CREATE POLICY "Trainers can view guest bookings"
ON public.guest_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Trainers can update guest bookings
CREATE POLICY "Trainers can update guest bookings"
ON public.guest_bookings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Trainers can delete guest bookings
CREATE POLICY "Trainers can delete guest bookings"
ON public.guest_bookings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_guest_bookings_updated_at
BEFORE UPDATE ON public.guest_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
