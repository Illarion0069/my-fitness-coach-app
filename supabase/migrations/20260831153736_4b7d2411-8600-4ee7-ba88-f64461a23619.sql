REVOKE ALL ON FUNCTION public.is_my_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_client(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_default_trainer_on_profile() FROM PUBLIC, anon, authenticated;