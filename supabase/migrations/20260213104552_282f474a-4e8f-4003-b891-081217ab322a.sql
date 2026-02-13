CREATE POLICY "Trainers can delete profiles"
  ON public.profiles FOR DELETE
  USING (has_role(auth.uid(), 'trainer'::app_role));