
-- Add is_trainer flag to profiles
ALTER TABLE public.profiles ADD COLUMN is_trainer boolean NOT NULL DEFAULT false;

-- Create client packages table for tracking sessions
CREATE TABLE public.client_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

-- Clients can view their own packages
CREATE POLICY "Users can view own packages"
  ON public.client_packages FOR SELECT
  USING (auth.uid() = user_id);

-- Trainers can view all packages
CREATE POLICY "Trainers can view all packages"
  ON public.client_packages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_trainer = true)
  );

-- Trainers can insert packages
CREATE POLICY "Trainers can insert packages"
  ON public.client_packages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_trainer = true)
  );

-- Trainers can update packages
CREATE POLICY "Trainers can update packages"
  ON public.client_packages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_trainer = true)
  );

-- Trainers can delete packages
CREATE POLICY "Trainers can delete packages"
  ON public.client_packages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_trainer = true)
  );

-- Trainers can view all profiles
CREATE POLICY "Trainers can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_trainer = true)
  );

-- Trainers can update all profiles  
CREATE POLICY "Trainers can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_trainer = true)
  );

-- Trigger for updated_at
CREATE TRIGGER update_client_packages_updated_at
  BEFORE UPDATE ON public.client_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
