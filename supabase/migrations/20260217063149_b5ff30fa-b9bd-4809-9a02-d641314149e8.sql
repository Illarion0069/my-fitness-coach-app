
-- Table for body measurements entered by trainer
CREATE TABLE public.body_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trainer_user_id UUID NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hips_cm NUMERIC(5,1),
  left_arm_cm NUMERIC(5,1),
  right_arm_cm NUMERIC(5,1),
  left_leg_cm NUMERIC(5,1),
  right_leg_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Trainers can do everything
CREATE POLICY "Trainers can view all measurements"
  ON public.body_measurements FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can insert measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update measurements"
  ON public.body_measurements FOR UPDATE
  USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can delete measurements"
  ON public.body_measurements FOR DELETE
  USING (has_role(auth.uid(), 'trainer'::app_role));

-- Clients can view their own measurements
CREATE POLICY "Users can view own measurements"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_body_measurements_updated_at
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, measured_at DESC);
