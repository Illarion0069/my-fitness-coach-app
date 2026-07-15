
CREATE POLICY "Trainers can insert ledger entries"
ON public.session_ledger
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'trainer'::app_role));
