
-- Nutrition daily logs (one row per user per day)
CREATE TABLE public.nutrition_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  water_ml INTEGER NOT NULL DEFAULT 0,
  coffee_cups INTEGER NOT NULL DEFAULT 0,
  tea_cups INTEGER NOT NULL DEFAULT 0,
  alcohol_ml INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- Food photos (multiple per day)
CREATE TABLE public.food_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url TEXT NOT NULL,
  meal_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_photos ENABLE ROW LEVEL SECURITY;

-- Clients can manage own nutrition logs
CREATE POLICY "Users can view own nutrition logs" ON public.nutrition_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition logs" ON public.nutrition_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition logs" ON public.nutrition_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nutrition logs" ON public.nutrition_logs FOR DELETE USING (auth.uid() = user_id);

-- Trainers can view all nutrition logs
CREATE POLICY "Trainers can view all nutrition logs" ON public.nutrition_logs FOR SELECT USING (has_role(auth.uid(), 'trainer'::app_role));

-- Clients can manage own food photos
CREATE POLICY "Users can view own food photos" ON public.food_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own food photos" ON public.food_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own food photos" ON public.food_photos FOR DELETE USING (auth.uid() = user_id);

-- Trainers can view all food photos
CREATE POLICY "Trainers can view all food photos" ON public.food_photos FOR SELECT USING (has_role(auth.uid(), 'trainer'::app_role));

-- Storage bucket for food photos
INSERT INTO storage.buckets (id, name, public) VALUES ('food-photos', 'food-photos', true);

-- Storage policies for food-photos bucket
CREATE POLICY "Users can upload own food photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view food photos" ON storage.objects FOR SELECT USING (bucket_id = 'food-photos');
CREATE POLICY "Users can delete own food photos" ON storage.objects FOR DELETE USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Updated_at trigger
CREATE TRIGGER update_nutrition_logs_updated_at BEFORE UPDATE ON public.nutrition_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime for trainer view
ALTER PUBLICATION supabase_realtime ADD TABLE public.nutrition_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.food_photos;
