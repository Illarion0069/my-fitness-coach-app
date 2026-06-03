ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nutrition_goal text NOT NULL DEFAULT 'fat_loss';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nutrition_goal_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nutrition_goal_check CHECK (nutrition_goal IN ('fat_loss','muscle_gain'));