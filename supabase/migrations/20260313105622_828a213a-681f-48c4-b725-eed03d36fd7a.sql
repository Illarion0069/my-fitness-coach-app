-- Allow trainers to update nutrition_logs (for score override)
CREATE POLICY "Trainers can update nutrition logs"
  ON public.nutrition_logs
  FOR UPDATE
  TO public
  USING (public.has_role(auth.uid(), 'trainer'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'trainer'::app_role));