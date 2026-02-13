
CREATE TABLE public.trainer_client_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL,
  client_order text[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_client_order ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_trainer_client_order_trainer ON public.trainer_client_order (trainer_user_id);

CREATE POLICY "Trainers can view own order"
  ON public.trainer_client_order FOR SELECT
  USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can insert own order"
  ON public.trainer_client_order FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers can update own order"
  ON public.trainer_client_order FOR UPDATE
  USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);
