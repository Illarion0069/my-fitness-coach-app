
-- Fix profiles policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can update all profiles" ON public.profiles;

CREATE POLICY "Trainers can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

-- Fix client_packages policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Trainers can view all packages" ON public.client_packages;
DROP POLICY IF EXISTS "Users can view own packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can insert packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can update packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can delete packages" ON public.client_packages;

CREATE POLICY "Trainers can view all packages"
  ON public.client_packages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Users can view own packages"
  ON public.client_packages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers can insert packages"
  ON public.client_packages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Trainers can update packages"
  ON public.client_packages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Trainers can delete packages"
  ON public.client_packages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

-- Fix user_roles policy too
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
