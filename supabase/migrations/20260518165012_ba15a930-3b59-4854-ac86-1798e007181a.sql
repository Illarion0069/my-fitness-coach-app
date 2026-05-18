-- CRITICAL FIX: has_role MUST be callable by authenticated role because RLS policies
-- reference it as `has_role(auth.uid(), 'trainer')`. SECURITY DEFINER changes who the
-- function runs AS, but the caller still needs EXECUTE permission to invoke it.
-- Revoking from authenticated broke all trainer access through RLS.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;