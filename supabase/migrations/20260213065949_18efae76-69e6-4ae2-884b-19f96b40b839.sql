
-- Step 1: Drop old policies that depend on is_trainer
DROP POLICY IF EXISTS "Trainers can view all packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can insert packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can update packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can delete packages" ON public.client_packages;
DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can update all profiles" ON public.profiles;

-- Step 2: Drop is_trainer column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_trainer;

-- Step 3: Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'trainer', 'client');

-- Step 4: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 6: RLS on user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 7: Recreate policies using has_role
CREATE POLICY "Trainers can view all packages"
  ON public.client_packages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));

CREATE POLICY "Trainers can insert packages"
  ON public.client_packages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'trainer'::public.app_role));

CREATE POLICY "Trainers can update packages"
  ON public.client_packages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));

CREATE POLICY "Trainers can delete packages"
  ON public.client_packages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));

CREATE POLICY "Trainers can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));

CREATE POLICY "Trainers can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'::public.app_role));
