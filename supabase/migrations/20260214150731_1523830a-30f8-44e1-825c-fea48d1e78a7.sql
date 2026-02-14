
CREATE TABLE public.test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nutrition_score INTEGER NOT NULL,
  nutrition_max INTEGER NOT NULL,
  health_score INTEGER NOT NULL,
  health_max INTEGER NOT NULL,
  overall_percentage INTEGER NOT NULL,
  answers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own results" ON public.test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own results" ON public.test_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view all results" ON public.test_results
  FOR SELECT USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE INDEX idx_test_results_user_id ON public.test_results(user_id);
CREATE INDEX idx_test_results_created_at ON public.test_results(created_at DESC);
