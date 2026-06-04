
-- Fix realtime.messages: drop overly broad SELECT and INSERT policies, keep scoped
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;

CREATE POLICY "Users can send only to own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (realtime.topic() LIKE '%' || auth.uid()::text || '%');

-- Lock down session_ledger writes for non-service-role users
CREATE POLICY "Deny client inserts on session_ledger"
ON public.session_ledger
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Deny client updates on session_ledger"
ON public.session_ledger
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny client deletes on session_ledger"
ON public.session_ledger
FOR DELETE
TO authenticated, anon
USING (false);
