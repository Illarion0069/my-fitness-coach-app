CREATE TABLE IF NOT EXISTS public.gbp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL UNIQUE,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_settings TO authenticated;
GRANT ALL ON public.gbp_settings TO service_role;

ALTER TABLE public.gbp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers read own gbp settings" ON public.gbp_settings
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers insert own gbp settings" ON public.gbp_settings
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers update own gbp settings" ON public.gbp_settings
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id)
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE POLICY "Trainers delete own gbp settings" ON public.gbp_settings
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) AND auth.uid() = trainer_user_id);

CREATE TRIGGER update_gbp_settings_updated_at
BEFORE UPDATE ON public.gbp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();