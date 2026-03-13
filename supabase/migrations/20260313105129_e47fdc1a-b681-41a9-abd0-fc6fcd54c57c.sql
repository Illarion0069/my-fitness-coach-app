ALTER TABLE public.nutrition_logs 
  ADD COLUMN trainer_override_score integer DEFAULT NULL,
  ADD COLUMN trainer_override_note text DEFAULT NULL;