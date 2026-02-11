
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Group training sessions
CREATE TABLE public.group_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 3,
  price_per_person NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  location TEXT DEFAULT 'Eleftherias 119, Limassol',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings for group sessions
CREATE TABLE public.group_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_phone TEXT NOT NULL,
  spot_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, spot_number),
  UNIQUE(session_id, participant_phone)
);

-- Enable RLS
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_bookings ENABLE ROW LEVEL SECURITY;

-- Public read access for sessions
CREATE POLICY "Anyone can view active sessions"
ON public.group_sessions FOR SELECT
USING (is_active = true);

-- Public read access for bookings
CREATE POLICY "Anyone can view bookings"
ON public.group_bookings FOR SELECT
USING (true);

-- Public insert for bookings
CREATE POLICY "Anyone can book a spot"
ON public.group_bookings FOR INSERT
WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_group_sessions_updated_at
BEFORE UPDATE ON public.group_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_bookings;
