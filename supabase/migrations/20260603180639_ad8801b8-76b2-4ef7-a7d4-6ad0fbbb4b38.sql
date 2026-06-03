
-- Add explicit deny policies for user_roles to prevent privilege escalation.
-- Only service_role (via edge functions) should ever insert/update/delete roles.
CREATE POLICY "Deny user_roles inserts to non-service"
  ON public.user_roles FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny user_roles updates to non-service"
  ON public.user_roles FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny user_roles deletes to non-service"
  ON public.user_roles FOR DELETE TO authenticated, anon
  USING (false);
