-- Phase 1: revoke EXECUTE on SECURITY DEFINER funcs from public/anon/authenticated
-- RLS policies still call has_role internally (SECURITY DEFINER bypasses caller perms),
-- and triggers still call handle_new_user (triggers run with table owner perms).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_password_reset_data() FROM PUBLIC, anon, authenticated;

-- Phase 2: explicit deny policies on password_reset_* (RLS enabled, no policies = closed,
-- but adding explicit deny makes intent obvious and removes linter "RLS enabled no policy" warns)
CREATE POLICY "Deny all client access to reset codes"
  ON public.password_reset_codes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all client access to reset attempts"
  ON public.password_reset_attempts
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);