
-- Enable RLS on realtime.messages (idempotent) and restrict to authenticated users.
-- Existing per-table RLS continues to filter postgres_changes rows by user_id.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
