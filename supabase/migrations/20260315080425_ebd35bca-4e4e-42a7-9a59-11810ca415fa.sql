
-- Achievements table for gamification
CREATE TABLE public.client_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  achievement_type text NOT NULL, -- 'session_milestone', 'nutrition_streak', 'nutrition_quality'
  title_en text NOT NULL,
  title_ru text NOT NULL,
  description_en text NOT NULL,
  description_ru text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.client_achievements ENABLE ROW LEVEL SECURITY;

-- Users can view own achievements
CREATE POLICY "Users can view own achievements"
  ON public.client_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trainers can view all achievements
CREATE POLICY "Trainers can view all achievements"
  ON public.client_achievements FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));

-- Insert only via service role (edge function), but also allow authenticated for upsert
CREATE POLICY "Authenticated can insert own achievements"
  ON public.client_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
