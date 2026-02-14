
-- Trainer working hours settings
CREATE TABLE public.trainer_working_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_user_id uuid NOT NULL UNIQUE,
  work_start_hour smallint NOT NULL DEFAULT 7,
  work_end_hour smallint NOT NULL DEFAULT 19,
  days_off smallint[] NOT NULL DEFAULT '{0}'::smallint[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- days_off stores day-of-week numbers (0=Sunday, 1=Monday, ..., 6=Saturday)

ALTER TABLE public.trainer_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view own hours"
ON public.trainer_working_hours FOR SELECT
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can insert own hours"
ON public.trainer_working_hours FOR INSERT
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can update own hours"
ON public.trainer_working_hours FOR UPDATE
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

-- Allow edge functions (service role) and clients to read for slot generation
CREATE POLICY "Anyone authenticated can read working hours"
ON public.trainer_working_hours FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_trainer_working_hours_updated_at
BEFORE UPDATE ON public.trainer_working_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default for existing trainers
INSERT INTO public.trainer_working_hours (trainer_user_id, work_start_hour, work_end_hour, days_off)
SELECT user_id, 7, 19, ARRAY[0]::smallint[]
FROM public.user_roles WHERE role = 'trainer'
ON CONFLICT (trainer_user_id) DO NOTHING;
