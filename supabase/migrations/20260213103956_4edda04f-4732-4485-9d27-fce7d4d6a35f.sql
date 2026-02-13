
-- Fix profiles policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;

CREATE POLICY "Trainers can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'trainer'::app_role));

-- Fix client_packages policies too
DROP POLICY IF EXISTS "Trainers can view all packages" ON public.client_packages;
DROP POLICY IF EXISTS "Users can view own packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can insert packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can update packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can delete packages" ON public.client_packages;

CREATE POLICY "Trainers can view all packages"
  ON public.client_packages FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Users can view own packages"
  ON public.client_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can insert packages"
  ON public.client_packages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update packages"
  ON public.client_packages FOR UPDATE
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can delete packages"
  ON public.client_packages FOR DELETE
  USING (has_role(auth.uid(), 'trainer'::app_role));
